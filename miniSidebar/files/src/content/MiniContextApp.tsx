import { gsap } from 'gsap'
import { useEffect, useRef, useState, useCallback, type FormEvent } from 'react'
import Draggable from 'react-draggable'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X, ChevronsLeft, Trash2, ArrowUp, ChevronUp, Image, AtSign } from 'lucide-react'
import { MESSAGE_TYPES, type AskSlmPayload, type ExtensionMessage, type SlmChunkPayload, type SlmDonePayload, type SlmErrorPayload, type ModelsResultPayload, type HealthResultPayload } from '../shared/messages'
import { db } from '../shared/db'
import { clip, normalize, nextId } from '../shared/utils'
import { STORAGE_KEYS, DEFAULT_MODEL } from '../shared/constants'

interface MiniContextAppProps {
  initiallyOpen: boolean
}

const CONTEXT_SELECTORS = [
  '[data-message-author-role]',
  '[data-testid*="conversation"]',
  '[data-testid*="message"]',
  'article',
  '[role="article"]',
] as const

// ── Context reading ──────────────────────────────────────────────────────────

const readSelectionSnippet = (): string => {
  const selection = window.getSelection()?.toString() ?? ''
  return clip(normalize(selection), 320)
}

const readConversationSnippet = (): string => {
  const snippets = new Set<string>()
  const selectors = CONTEXT_SELECTORS.join(',')
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selectors))

  for (const node of nodes.slice(-14)) {
    const text = clip(normalize(node.innerText || node.textContent || ''), 260)
    if (text.length >= 24) snippets.add(text)
  }

  return clip(Array.from(snippets).slice(-3).join('\n'), 540)
}

const readContextSnippet = (): string => {
  return readSelectionSnippet() || readConversationSnippet() || clip(normalize(document.title || ''), 120)
}

const hasFocusRequest = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') return false
  return Boolean((payload as { focusInput?: unknown }).focusInput)
}

const askSlm = async (payload: AskSlmPayload): Promise<void> => {
  chrome.runtime.sendMessage({ type: MESSAGE_TYPES.ASK_SLM, payload })
}

// ── Simple markdown renderer ─────────────────────────────────────────────────

const renderMarkdown = (text: string): string => {
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="bg-[#0a0a0a] border border-slate-800/60 rounded-lg p-3 my-2 overflow-x-auto text-[13px] font-mono text-slate-300"><code>${code.trim()}</code></pre>`
  )

  // Inline code
  html = html.replace(/`([^`]+)`/g,
    '<code class="bg-[#1a1a1a] text-slate-300 px-1.5 py-0.5 rounded text-[13px] font-mono">$1</code>'
  )

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-100 font-semibold">$1</strong>')

  // Italic
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')

  // Unordered list items
  html = html.replace(/^[-•] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')

  // Ordered list items
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')

  // Line breaks
  html = html.replace(/\n/g, '<br />')

  return html
}

// ── Relative time formatter ──────────────────────────────────────────────────

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

// ── Component ────────────────────────────────────────────────────────────────

const MiniContextApp = ({ initiallyOpen }: MiniContextAppProps) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')

  const [streamingChatId, setStreamingChatId] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)

  // Model selector state
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null)

  // Thinking timer
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null)
  const [thinkingElapsed, setThinkingElapsed] = useState(0)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const chats = useLiveQuery(() => db.chats.orderBy('updatedAt').reverse().toArray(), [])
  const messages = useLiveQuery(
    () => (activeChatId ? db.messages.where('chatId').equals(activeChatId).sortBy('createdAt') : []),
    [activeChatId]
  )

  // ── Load model + health on mount ──

  useEffect(() => {
    // Load selected model from storage
    chrome.storage.sync.get([STORAGE_KEYS.SELECTED_MODEL], (result: Record<string, unknown>) => {
      const m = result[STORAGE_KEYS.SELECTED_MODEL]
      if (typeof m === 'string') setSelectedModel(m)
    })

    // Health check
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.HEALTH_CHECK }, (res: HealthResultPayload) => {
      setOllamaOnline(res?.online ?? false)
    })

    // Fetch available models
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.LIST_MODELS }, (res: ModelsResultPayload) => {
      if (res?.models?.length) setAvailableModels(res.models)
    })
  }, [])

  // ── Thinking timer tick ──

  useEffect(() => {
    if (!thinkingStartTime) return
    const interval = setInterval(() => {
      setThinkingElapsed(Math.floor((Date.now() - thinkingStartTime) / 1000))
    }, 100)
    return () => clearInterval(interval)
  }, [thinkingStartTime])

  // ── Panel open/close animation ──

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    gsap.killTweensOf(panel)
    gsap.to(panel, {
      opacity: isOpen ? 1 : 0,
      y: isOpen ? 0 : 16,
      scale: isOpen ? 1 : 0.97,
      pointerEvents: isOpen ? 'auto' : 'none',
      duration: 0.24,
      ease: isOpen ? 'power2.out' : 'power2.in',
    })
  }, [isOpen])

  // ── Auto-scroll to latest message ──

  useEffect(() => {
    const threadContainer = threadRef.current
    if (!threadContainer || !messages || messages.length === 0) return
    const items = threadContainer.querySelectorAll<HTMLElement>('[data-thread-item]')
    const latestItem = items[items.length - 1]
    if (!latestItem) return

    // Only animate if it's a new message or we just started streaming
    // Use a ref or simple check to avoid pulsing on every single chunk
    const isNewMessage = items.length > (threadContainer.dataset.lastCount ? parseInt(threadContainer.dataset.lastCount) : 0)
    
    if (isNewMessage) {
      gsap.fromTo(latestItem, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' })
    }

    threadContainer.dataset.lastCount = String(items.length)
    latestItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [messages, streamingText])

  // ── Message listener ──

  useEffect(() => {
    const onMessage = async (message: ExtensionMessage) => {
      if (message.type === MESSAGE_TYPES.TOGGLE_PANEL) {
        setIsOpen((c) => !c)
        return
      }
      if (message.type === MESSAGE_TYPES.OPEN_PANEL) {
        setIsOpen(true)
        if (hasFocusRequest(message.payload)) {
          setTimeout(() => inputRef.current?.focus(), 90)
        }
        return
      }
      if (message.type === MESSAGE_TYPES.CLOSE_PANEL) {
        setIsOpen(false)
        return
      }
      if (message.type === MESSAGE_TYPES.SLM_CHUNK) {
        const payload = message.payload as SlmChunkPayload
        if (payload.chatId) {
          setStreamingChatId(payload.chatId)
          setStreamingText((prev) => prev + payload.text)
        }
        return
      }
      if (message.type === MESSAGE_TYPES.SLM_ERROR) {
        const payload = message.payload as SlmErrorPayload
        setError(payload.error || 'An error occurred')
        return
      }
      if (message.type === MESSAGE_TYPES.SLM_DONE) {
        const payload = message.payload as SlmDonePayload
        if (payload.chatId) {
          // Get the final text from the state and clear it
          setStreamingText((currentText) => {
            if (currentText.trim()) {
              // Perform DB side effect OUTSIDE of the state updater
              // Since setStreamingText is called here, we have the latest value
              // but we should use a temporary variable or ensure we don't double-save
              void db.messages.add({
                id: nextId(),
                chatId: payload.chatId!,
                role: 'slm',
                text: currentText,
                createdAt: Date.now(),
              })
            }
            return ''
          })
          setStreamingChatId(null)
          setThinkingStartTime(null)
        }
        return
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [])

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey && event.shiftKey && event.code === 'KeyS') {
        event.preventDefault()
        setIsOpen((c) => !c)
        return
      }
      if (event.key === 'Escape' && isOpen) setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  // ── Actions ──

  const createNewChat = useCallback(() => {
    setActiveChatId(null)
    setQuestion('')
  }, [])

  const deleteChat = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await db.messages.where('chatId').equals(id).delete()
    await db.chats.delete(id)
    if (activeChatId === id) setActiveChatId(null)
  }, [activeChatId])

  const selectModel = useCallback((model: string) => {
    setSelectedModel(model)
    setShowModelDropdown(false)
    chrome.storage.sync.set({ [STORAGE_KEYS.SELECTED_MODEL]: model })
  }, [])

  const submitQuestion = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || streamingChatId) return

    let currentChat = activeChatId
    const latestContext = readContextSnippet()

    if (!currentChat) {
      currentChat = nextId()
      await db.chats.add({
        id: currentChat,
        title: clip(trimmedQuestion, 40),
        updatedAt: Date.now(),
        contextSnippet: latestContext,
        pageUrl: window.location.href,
        pageTitle: document.title,
      })
      setActiveChatId(currentChat)
    } else {
      await db.chats.update(currentChat, { updatedAt: Date.now() })
    }

    setQuestion('')
    setError('')
    setStreamingText('')
    setStreamingChatId(currentChat)
    setThinkingStartTime(Date.now())

    await db.messages.add({
      id: nextId(),
      chatId: currentChat,
      role: 'you',
      text: trimmedQuestion,
      createdAt: Date.now(),
    })

    try {
      await askSlm({
        prompt: trimmedQuestion,
        contextSnippet: latestContext,
        pageTitle: document.title,
        pageUrl: window.location.href,
        chatId: currentChat,
      })
    } catch (submitError) {
      const fallbackMessage = submitError instanceof Error ? submitError.message : 'Error starting local model.'
      setError(fallbackMessage)
      setStreamingChatId(null)
      setThinkingStartTime(null)
    }
  }

  // ── Sub-renders ──

  const renderChatTabs = () => {
    if (!chats || chats.length < 2) return null
    const recentChats = chats.slice(0, 5)
    return (
      <div className="flex items-center gap-0.5 px-3 pt-1 overflow-x-auto scrollbar-none">
        {recentChats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => setActiveChatId(chat.id)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap ${
              activeChatId === chat.id
                ? 'bg-slate-800/80 text-slate-200'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
            }`}
          >
            {clip(chat.title, 16)}
          </button>
        ))}
      </div>
    )
  }

  const renderChatList = () => (
    <div className="absolute bottom-16 left-4 w-[280px] bg-[#1c1c1c] border border-slate-800/80 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1.5 mb-1">Past Chats</div>
      <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1 scrollbar-thin">
        {!chats || chats.length === 0 ? (
          <div className="p-3 text-center text-slate-500 text-xs italic">No active conversations</div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                setActiveChatId(chat.id)
                setShowHistory(false)
              }}
              className="group flex justify-between items-center p-2 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0 pr-2 flex justify-between items-center">
                <div className="text-sm font-medium text-slate-300 truncate">{chat.title}</div>
                <div className="text-[10px] font-mono text-slate-600 ml-2">
                  {formatRelativeTime(chat.updatedAt)}
                </div>
              </div>
              <button
                onClick={(e) => deleteChat(chat.id, e)}
                className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded ml-1"
                aria-label="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )

  const renderActiveChat = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Dynamic Title */}
      <div className="mb-2 shrink-0 px-1 mt-6">
        <h2 className="text-xl font-medium text-slate-100 tracking-tight">
          {activeChatId ? (chats?.find((c) => c.id === activeChatId)?.title || 'Project 1') : 'New Project'}
        </h2>
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto space-y-5 mb-4 pr-2 scrollbar-thin flex flex-col pt-2" ref={threadRef}>
        {!messages?.length && !streamingText ? (
          <div className="flex-1 flex flex-col justify-end pb-4 text-slate-500/50 text-sm font-medium items-center text-center opacity-0" />
        ) : (
          <>
            {messages?.map((item) => (
              <div
                key={item.id}
                data-thread-item
                className={`text-[15px] leading-relaxed max-w-[92%] ${
                  item.role === 'you'
                    ? 'bg-[#1c1c1c] text-slate-200 rounded-2xl rounded-tr-sm p-3.5 self-end'
                    : 'text-slate-300 self-start p-1'
                }`}
              >
                {item.role === 'slm' ? (
                  <div
                    className="whitespace-pre-wrap prose-mini"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(item.text) }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap">{item.text}</div>
                )}
              </div>
            ))}

            {/* Streaming text */}
            {streamingChatId === activeChatId && streamingText && (
              <div data-thread-item className="text-[15px] leading-relaxed max-w-[92%] text-slate-300 self-start p-1">
                <div
                  className="whitespace-pre-wrap prose-mini"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }}
                />
              </div>
            )}

            {/* Thinking indicator with real timer */}
            {streamingChatId === activeChatId && !streamingText && (
              <div className="flex flex-col gap-2 self-start p-1">
                <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5 opacity-80">
                  <ChevronUp className="w-3 h-3 rotate-90" />
                  Thought for {thinkingElapsed}s
                </div>
                <div className="text-sm font-mono text-slate-500 animate-pulse">
                  {'> Thinking.....'}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={submitQuestion} className="relative mt-auto shrink-0 bg-[#1c1c1c] rounded-[20px] p-2 flex flex-col shadow-inner shadow-black/20">
        <textarea
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask according to context..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submitQuestion(e as unknown as FormEvent<HTMLFormElement>)
            }
          }}
          className="w-full bg-transparent border-none py-2 px-3 text-[14px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-0 resize-none h-[44px] scrollbar-none"
        />
        <div className="flex justify-between items-center mt-1 px-1 relative">
          {/* Attach menu button */}
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
          >
            {showAttachMenu ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>

          {showAttachMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-40 bg-[#151515] border border-slate-800/80 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 rounded-md transition-colors"
                onClick={() => setShowAttachMenu(false)}
              >
                <AtSign className="w-3.5 h-3.5" />
                Mentions
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 rounded-md transition-colors"
                onClick={() => setShowAttachMenu(false)}
              >
                <Image className="w-3.5 h-3.5" />
                Media
              </button>
            </div>
          )}

          {/* Model selector dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/50 rounded-full text-xs font-mono text-slate-400 cursor-pointer hover:bg-slate-800 transition-colors"
            >
              <ChevronUp className={`w-3 h-3 transition-transform ${showModelDropdown ? '' : 'rotate-180'}`} />
              <span className="flex items-center gap-1.5">
                {ollamaOnline === true && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
                {ollamaOnline === false && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
                {selectedModel}
              </span>
            </button>

            {showModelDropdown && (
              <div className="absolute bottom-full right-0 mb-2 w-52 bg-[#151515] border border-slate-800/80 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 max-h-[200px] overflow-y-auto scrollbar-thin">
                {availableModels.length === 0 ? (
                  <div className="p-2 text-xs text-slate-500 italic text-center">
                    {ollamaOnline === false ? 'Ollama offline' : 'No models found'}
                  </div>
                ) : (
                  availableModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => selectModel(model)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md transition-colors text-left ${
                        selectedModel === model
                          ? 'bg-slate-800/80 text-slate-200'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      {model}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!question.trim() || !!streamingChatId}
            className="p-1.5 bg-[#2a2a2a] hover:bg-[#333333] disabled:bg-[#202020] disabled:text-slate-600 text-slate-300 rounded-full transition-colors flex items-center justify-center w-8 h-8"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="absolute -top-10 left-0 right-0 bg-red-900/50 border border-red-700/50 text-red-200 text-xs p-2 rounded-lg backdrop-blur-md">
            {error}
          </div>
        )}
      </form>

      {/* Bottom: past chats toggle */}
      <div className="mt-4 flex items-center shrink-0">
        <button
          onClick={() => setShowHistory((prev) => !prev)}
          className="text-[11px] font-medium text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors group"
        >
          Past chats
          <ChevronUp className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showHistory && renderChatList()}
    </div>
  )

  // ── Main render ──

  return (
    <div 
      className="fixed right-4 bottom-4 flex flex-col items-end gap-2 font-[system-ui,sans-serif] antialiased"
      style={{ zIndex: 2147483647 }} 
    >
      <Draggable 
        nodeRef={panelRef} 
        handle=".drag-handle" 
        bounds="body" 
        defaultPosition={{ x: 0, y: 0 }}
      >
        <div
          ref={panelRef}
          className={`w-[420px] h-[640px] max-h-[85vh] flex flex-col bg-[#131313] text-slate-200 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden
            ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <div className="drag-handle absolute top-0 left-0 right-0 h-10 z-10 cursor-grab active:cursor-grabbing" />

          {/* Header actions */}
          <div className="flex items-center justify-end gap-3 p-3 relative z-20 pointer-events-none">
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button onClick={createNewChat} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat tabs */}
          {renderChatTabs()}

          {/* Main content area */}
          <div className="flex-1 px-5 pb-4 overflow-hidden relative">
            <div className="absolute inset-5 max-h-full">
              {renderActiveChat()}
            </div>
          </div>
        </div>
      </Draggable>
    </div>
  )
}

export default MiniContextApp
