import { gsap } from 'gsap'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Draggable from 'react-draggable'
import { useLiveQuery } from 'dexie-react-hooks'
import { MessageSquare, Plus, X, ChevronsLeft, Trash2, ArrowUp, ChevronUp, Image, AtSign } from 'lucide-react'
import { MESSAGE_TYPES, type AskSlmPayload, type ExtensionMessage, type SlmChunkPayload, type SlmDonePayload } from '../shared/messages'
import { db } from '../shared/db'

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

const clip = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim()

const nextId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

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
    if (text.length >= 24) {
      snippets.add(text)
    }
  }

  const combined = Array.from(snippets).slice(-3).join('\n')
  return clip(combined, 540)
}

const readContextSnippet = (): string => {
  const selectionSnippet = readSelectionSnippet()
  if (selectionSnippet) {
    return selectionSnippet
  }

  const conversationSnippet = readConversationSnippet()
  if (conversationSnippet) {
    return conversationSnippet
  }

  return clip(normalize(document.title || ''), 120)
}

const hasFocusRequest = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  const withFocus = payload as { focusInput?: unknown }
  return Boolean(withFocus.focusInput)
}

const askSlm = async (payload: AskSlmPayload): Promise<void> => {
  const message: ExtensionMessage<AskSlmPayload> = {
    type: MESSAGE_TYPES.ASK_SLM,
    payload,
  }
  chrome.runtime.sendMessage(message)
}

const MiniContextApp = ({ initiallyOpen }: MiniContextAppProps) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [contextPreview, setContextPreview] = useState(() => readContextSnippet())
  
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)

  const launcherRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const chats = useLiveQuery(() => db.chats.orderBy('updatedAt').reverse().toArray(), [])
  const messages = useLiveQuery(
    () => (activeChatId ? db.messages.where('chatId').equals(activeChatId).sortBy('createdAt') : []),
    [activeChatId]
  )

  useEffect(() => {
    const launcher = launcherRef.current
    if (!launcher) return
    const timeline = gsap.timeline()
    timeline.fromTo(
      launcher,
      { opacity: 0, y: 12, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'power2.out' },
    )
    timeline.to(launcher, { scale: 1.04, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '+=0.45')
    return () => { timeline.kill() }
  }, [])

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

  useEffect(() => {
    const threadContainer = threadRef.current
    if (!threadContainer || !messages || messages.length === 0) return
    const items = threadContainer.querySelectorAll<HTMLElement>('[data-thread-item]')
    const latestItem = items[items.length - 1]
    if (!latestItem) return
    gsap.fromTo(latestItem, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' })
    latestItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [messages?.length, streamingText])

  useEffect(() => {
    const onMessage = async (message: ExtensionMessage) => {
      console.log('MiniContextApp received message:', message.type);
      if (message.type === MESSAGE_TYPES.TOGGLE_PANEL) {
        setIsOpen((current) => !current)
        return
      }
      if (message.type === MESSAGE_TYPES.OPEN_PANEL) {
        setIsOpen(true)
        if (hasFocusRequest(message.payload)) {
          window.setTimeout(() => inputRef.current?.focus(), 90)
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
          setStreamingText(prev => prev + payload.text)
        }
        return
      }
      if (message.type === MESSAGE_TYPES.SLM_DONE) {
        const payload = message.payload as SlmDonePayload
        if (payload.chatId) {
          setStreamingText(currentText => {
            if (currentText.trim()) {
              db.messages.add({
                id: nextId(),
                chatId: payload.chatId!,
                role: 'slm',
                text: currentText,
                createdAt: Date.now()
              }).catch(console.error)
            }
            return ''
          })
          setStreamingChatId(null)
        }
        return
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey && event.shiftKey && event.code === 'KeyS') {
        event.preventDefault()
        setIsOpen((current) => !current)
        return
      }
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const refreshContext = (): void => {
    setContextPreview(readContextSnippet())
  }

  const createNewChat = () => {
    setActiveChatId(null)
    setQuestion('')
    refreshContext()
  }

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await db.messages.where('chatId').equals(id).delete()
    await db.chats.delete(id)
    if (activeChatId === id) setActiveChatId(null)
  }

  const submitQuestion = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion || streamingChatId) return

    let currentChat = activeChatId
    const latestContext = contextPreview || readContextSnippet()
    
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
    
    await db.messages.add({
      id: nextId(),
      chatId: currentChat,
      role: 'you',
      text: trimmedQuestion,
      createdAt: Date.now()
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
    }
  }

  const renderChatList = () => (
    <div className="absolute bottom-16 left-4 w-[280px] bg-[#1c1c1c] border border-slate-800/80 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1.5 mb-1">Past Chats</div>
      <div className="max-h-[300px] overflow-y-auto pr-1 space-y-1 scrollbar-thin">
        {!chats || chats.length === 0 ? (
          <div className="p-3 text-center text-slate-500 text-xs italic">
            No active conversations
          </div>
        ) : (
          chats.map(chat => (
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
                  {Math.floor((Date.now() - (chat.updatedAt || Date.now())) / 3600000)}h
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
      {/* Dynamic Title Area */}
      <div className="mb-2 shrink-0 px-1 mt-6">
        <h2 className="text-xl font-medium text-slate-100 tracking-tight">
          {activeChatId ? (chats?.find(c => c.id === activeChatId)?.title || 'Project 1') : 'New Project'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 mb-4 pr-2 scrollbar-thin flex flex-col pt-2" ref={threadRef}>
        {!messages?.length && !streamingText ? (
          <div className="flex-1 flex flex-col justify-end pb-4 text-slate-500/50 text-sm font-medium items-center text-center opacity-0">
            {/* Kept ready area empty or very subtle per mockup */}
          </div>
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
                {item.role === 'slm' && (
                  <div className="mb-3 bg-[#121212] border border-slate-800/60 rounded-lg py-2 px-3 text-[13px] text-slate-400 flex items-center justify-between shadow-sm">
                     <span className="truncate flex-1">Check architecture.md</span>
                     <div className="text-slate-600 ml-2"></div> 
                  </div>
                )}
                <div className="whitespace-pre-wrap">{item.text}</div>
              </div>
            ))}
            
            {streamingChatId === activeChatId && streamingText && (
              <div
                data-thread-item
                className="text-[15px] leading-relaxed max-w-[92%] text-slate-300 self-start p-1"
              >
                <div className="whitespace-pre-wrap">{streamingText}</div>
              </div>
            )}
            
            {streamingChatId === activeChatId && !streamingText && (
               <div className="flex flex-col gap-2 self-start p-1">
                 <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5 opacity-80">
                   <ChevronUp className="w-3 h-3 rotate-90" />
                   Thought for 10s
                 </div>
                 <div className="text-sm font-mono text-slate-500 animate-pulse">
                   {'> Thinking.....'}
                 </div>
               </div>
            )}
          </>
        )}
      </div>

      <form onSubmit={submitQuestion} className="relative mt-auto shrink-0 bg-[#1c1c1c] rounded-[20px] p-2 flex flex-col shadow-inner shadow-black/20">
        <textarea
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask according to context..."
          onKeyDown={(e) => {
             if (e.key === 'Enter' && !e.shiftKey) {
               e.preventDefault()
               submitQuestion(e as any)
             }
          }}
          className="w-full bg-transparent border-none py-2 px-3 text-[14px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-0 resize-none h-[44px] scrollbar-none"
        />
        <div className="flex justify-between items-center mt-1 px-1 relative">
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
          
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/50 rounded-full text-xs font-mono text-slate-400 cursor-pointer hover:bg-slate-800 transition-colors">
            <ChevronUp className="w-3 h-3" />
            ollama
          </div>

          <button
            type="submit"
            disabled={!question.trim() || !!streamingChatId}
            className="p-1.5 bg-[#2a2a2a] hover:bg-[#333333] disabled:bg-[#202020] disabled:text-slate-600 text-slate-300 rounded-full transition-colors flex items-center justify-center w-8 h-8"
          >
             <ArrowUp className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <div className="absolute -top-10 left-0 right-0 bg-red-900/50 border border-red-700/50 text-red-200 text-xs p-2 rounded-lg backdrop-blur-md">
            {error}
          </div>
        )}
      </form>
      
      {/* Bottom context / chat toggle bar */}
      <div className="mt-4 flex items-center shrink-0">
          <button
            onClick={() => setShowHistory(prev => !prev)}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors group"
          >
            Past chats 
            <ChevronUp className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
      </div>
      
      {showHistory && renderChatList()}
    </div>
  )

  return (
    <div className="fixed right-4 bottom-4 z-[2147483647] flex flex-col items-end gap-2 font-[system-ui,sans-serif] antialiased">
      <button
        ref={launcherRef}
        onClick={() => setIsOpen(curr => !curr)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-full text-sm font-semibold shadow-lg shadow-blue-500/25 transition-transform hover:scale-105 active:scale-95 border border-blue-400/20"
      >
        <MessageSquare className="w-4 h-4" />
        {isOpen ? 'Close Context' : 'Mini Context'}
      </button>

      {/* Adding a wrapping div to support react-draggable since Draggable injects styles */}
      <Draggable handle=".drag-handle" bounds="body" defaultPosition={{x: 0, y: 0}}>
        <div
          ref={panelRef}
          className={`absolute bottom-full right-0 mb-4 w-[420px] h-[640px] max-h-[85vh] flex flex-col bg-[#131313] text-slate-200 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden
            ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        >
          <div className="drag-handle absolute top-0 left-0 right-0 h-10 z-10 cursor-grab active:cursor-grabbing"></div>
          
          {/* Top Header Actions */}
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
