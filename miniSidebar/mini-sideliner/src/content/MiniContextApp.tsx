import { gsap } from 'gsap'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { MESSAGE_TYPES, type AskSlmPayload, type AskSlmResponse, type ExtensionMessage } from '../shared/messages'

interface MiniContextAppProps {
  initiallyOpen: boolean
}

interface ThreadItem {
  id: string
  role: 'you' | 'slm'
  text: string
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

const askSlm = async (payload: AskSlmPayload): Promise<string> =>
  new Promise((resolve, reject) => {
    const message: ExtensionMessage<AskSlmPayload> = {
      type: MESSAGE_TYPES.ASK_SLM,
      payload,
    }

    chrome.runtime.sendMessage(message, (response: AskSlmResponse | undefined) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      resolve(response?.answer ?? 'No response received from SLM placeholder.')
    })
  })

const animateHoverIn = (target: EventTarget | null): void => {
  if (!(target instanceof HTMLElement)) {
    return
  }
  gsap.to(target, { y: -1, scale: 1.01, duration: 0.14, ease: 'power2.out' })
}

const animateHoverOut = (target: EventTarget | null): void => {
  if (!(target instanceof HTMLElement)) {
    return
  }
  gsap.to(target, { y: 0, scale: 1, duration: 0.14, ease: 'power2.out' })
}

const wrapperStyle: CSSProperties = {
  position: 'fixed',
  right: '16px',
  bottom: '16px',
  zIndex: 2147483647,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '8px',
  fontFamily:
    "'IBM Plex Sans', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const launcherStyle: CSSProperties = {
  border: 'none',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #1a6dff, #2f84ff)',
  color: '#ffffff',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 10px 24px rgba(7, 72, 193, 0.38)',
}

const panelStyle: CSSProperties = {
  width: '360px',
  maxHeight: '76vh',
  overflow: 'hidden',
  background: '#0f1329',
  border: '1px solid #2b3568',
  borderRadius: '14px',
  color: '#d8deff',
  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
  padding: '12px',
}

const contextStyle: CSSProperties = {
  marginTop: '8px',
  borderRadius: '10px',
  border: '1px solid #27396f',
  background: '#101a3a',
  color: '#b6c6ff',
  padding: '8px',
  fontSize: '11px',
  lineHeight: 1.4,
  whiteSpace: 'pre-wrap',
}

const threadStyle: CSSProperties = {
  marginTop: '8px',
  maxHeight: '180px',
  overflowY: 'auto',
  borderRadius: '10px',
  border: '1px solid #223162',
  background: '#0b1125',
  padding: '8px',
  display: 'grid',
  gap: '6px',
}

const messageBubbleStyle: CSSProperties = {
  borderRadius: '10px',
  padding: '8px',
  fontSize: '12px',
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '70px',
  resize: 'vertical',
  borderRadius: '10px',
  border: '1px solid #2b3568',
  background: '#090d1f',
  color: '#eef2ff',
  padding: '8px 10px',
  outline: 'none',
}

const actionStyle: CSSProperties = {
  marginTop: '8px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '8px',
}

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: '9px',
  background: '#22a061',
  color: '#ffffff',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #39437a',
  borderRadius: '9px',
  background: 'transparent',
  color: '#d8deff',
  padding: '8px 12px',
  fontSize: '12px',
  cursor: 'pointer',
}

const MiniContextApp = ({ initiallyOpen }: MiniContextAppProps) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState<ThreadItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [contextPreview, setContextPreview] = useState(() => readContextSnippet())
  const launcherRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)
  const loadingDotsRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const launcher = launcherRef.current
    if (!launcher) {
      return
    }

    const timeline = gsap.timeline()
    timeline.fromTo(
      launcher,
      { opacity: 0, y: 12, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'power2.out' },
    )
    timeline.to(launcher, { scale: 1.04, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '+=0.45')

    return () => {
      timeline.kill()
    }
  }, [])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) {
      return
    }

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
    if (!threadContainer || thread.length === 0) {
      return
    }

    const items = threadContainer.querySelectorAll<HTMLElement>('[data-thread-item]')
    const latestItem = items[items.length - 1]
    if (!latestItem) {
      return
    }

    gsap.fromTo(latestItem, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' })
    latestItem.scrollIntoView({ block: 'nearest' })
  }, [thread])

  useEffect(() => {
    const dotsRoot = loadingDotsRef.current
    if (!dotsRoot) {
      return
    }

    const dots = Array.from(dotsRoot.querySelectorAll<HTMLElement>('[data-dot]'))
    if (dots.length === 0) {
      return
    }

    if (!isLoading) {
      gsap.set(dots, { opacity: 0.45 })
      return
    }

    const tween = gsap.to(dots, {
      opacity: 1,
      duration: 0.2,
      stagger: 0.1,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    })

    return () => {
      tween.kill()
      gsap.set(dots, { opacity: 0.45 })
    }
  }, [isLoading])

  useEffect(() => {
    const onMessage = (message: ExtensionMessage) => {
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
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage)
    }
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

  const launcherLabel = useMemo(() => (isOpen ? 'Hide mini context' : 'Mini context'), [isOpen])

  const refreshContext = (): void => {
    setContextPreview(readContextSnippet())
  }

  const clearThread = (): void => {
    setThread([])
    setError('')
  }

  const submitQuestion = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion || isLoading) {
      return
    }

    const latestContext = contextPreview || readContextSnippet()
    setContextPreview(latestContext)
    setQuestion('')
    setError('')
    setIsLoading(true)
    setThread((current) => [...current, { id: nextId(), role: 'you', text: trimmedQuestion }])

    try {
      const answer = await askSlm({
        prompt: trimmedQuestion,
        contextSnippet: latestContext,
        pageTitle: document.title,
        pageUrl: window.location.href,
      })

      setThread((current) => [...current, { id: nextId(), role: 'slm', text: answer }])
    } catch (submitError) {
      const fallbackMessage =
        submitError instanceof Error
          ? submitError.message
          : 'Failed to get a side-answer from the SLM placeholder.'
      setError(fallbackMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={wrapperStyle}>
      <button
        ref={launcherRef}
        type="button"
        style={launcherStyle}
        onClick={() => setIsOpen((current) => !current)}
        onMouseEnter={(event) => animateHoverIn(event.currentTarget)}
        onMouseLeave={(event) => animateHoverOut(event.currentTarget)}
      >
        {launcherLabel}
      </button>
      <div
        ref={panelRef}
        style={{
          ...panelStyle,
          opacity: initiallyOpen ? 1 : 0,
          pointerEvents: initiallyOpen ? 'auto' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '12px', color: '#a6b4ea' }}>
            Ask a side question without disrupting your active LLM conversation.
          </div>
          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => setIsOpen(false)}
            onMouseEnter={(event) => animateHoverIn(event.currentTarget)}
            onMouseLeave={(event) => animateHoverOut(event.currentTarget)}
          >
            Close
          </button>
        </div>

        <div style={contextStyle}>
          <strong style={{ color: '#d5deff' }}>Context snapshot</strong>
          <div style={{ marginTop: '4px' }}>{contextPreview || 'No context detected yet.'}</div>
          <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={refreshContext}
              onMouseEnter={(event) => animateHoverIn(event.currentTarget)}
              onMouseLeave={(event) => animateHoverOut(event.currentTarget)}
            >
              Refresh context
            </button>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={clearThread}
              onMouseEnter={(event) => animateHoverIn(event.currentTarget)}
              onMouseLeave={(event) => animateHoverOut(event.currentTarget)}
            >
              Clear side thread
            </button>
          </div>
        </div>

        <div ref={threadRef} style={threadStyle}>
          {thread.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#98a5d9' }}>No side questions yet.</div>
          ) : (
            thread.map((item) => (
              <div
                key={item.id}
                data-thread-item
                style={{
                  ...messageBubbleStyle,
                  border: item.role === 'you' ? '1px solid #2f4b8f' : '1px solid #2c684f',
                  background: item.role === 'you' ? '#13214b' : '#0b1f19',
                  color: item.role === 'you' ? '#dbe6ff' : '#c9ffe2',
                }}
              >
                <strong style={{ display: 'block', marginBottom: '3px', fontSize: '11px' }}>
                  {item.role === 'you' ? 'You' : 'SLM'}
                </strong>
                {item.text}
              </div>
            ))
          )}
        </div>

        <form onSubmit={submitQuestion} style={{ marginTop: '8px' }}>
          <textarea
            ref={inputRef}
            style={inputStyle}
            value={question}
            placeholder="Ask your minor question here..."
            onChange={(event) => setQuestion(event.target.value)}
          />
          <div style={actionStyle}>
            <button
              type="submit"
              style={primaryButtonStyle}
              disabled={isLoading}
              onMouseEnter={(event) => animateHoverIn(event.currentTarget)}
              onMouseLeave={(event) => animateHoverOut(event.currentTarget)}
            >
              Ask SLM
            </button>
            <div
              ref={loadingDotsRef}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                minHeight: '18px',
                color: '#9fb0e6',
                fontSize: '11px',
              }}
            >
              {isLoading ? <span>Thinking</span> : null}
              <span data-dot>.</span>
              <span data-dot>.</span>
              <span data-dot>.</span>
            </div>
          </div>
        </form>

        {error ? (
          <div
            style={{
              marginTop: '10px',
              borderRadius: '10px',
              border: '1px solid #793041',
              background: '#2b1317',
              color: '#ffc2cf',
              padding: '8px',
              fontSize: '12px',
              lineHeight: 1.45,
            }}
          >
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default MiniContextApp

