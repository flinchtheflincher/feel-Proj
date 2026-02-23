import { gsap } from 'gsap'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { DEFAULT_AUTO_OPEN, STORAGE_KEYS } from '../shared/constants'
import { MESSAGE_TYPES, type AskSlmPayload, type AskSlmResponse, type ExtensionMessage } from '../shared/messages'

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

const popupRootStyle: CSSProperties = {
  width: '360px',
  minHeight: '332px',
  padding: '14px',
  background: '#0b1022',
  color: '#dce4ff',
  fontFamily:
    "'IBM Plex Sans', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

const cardStyle: CSSProperties = {
  border: '1px solid #2a3569',
  borderRadius: '12px',
  padding: '12px',
  background: '#131937',
}

const textAreaStyle: CSSProperties = {
  width: '100%',
  minHeight: '82px',
  marginTop: '8px',
  borderRadius: '10px',
  border: '1px solid #2a3569',
  background: '#0b1022',
  color: '#e9edff',
  padding: '8px 10px',
  resize: 'vertical',
}

const askButtonStyle: CSSProperties = {
  marginTop: '8px',
  border: 'none',
  borderRadius: '10px',
  background: '#1f9f62',
  color: '#ffffff',
  padding: '8px 12px',
  fontWeight: 600,
  cursor: 'pointer',
}

const smallButtonStyle: CSSProperties = {
  border: '1px solid #2a3569',
  borderRadius: '8px',
  background: 'transparent',
  color: '#dce4ff',
  padding: '6px 10px',
  fontSize: '12px',
  cursor: 'pointer',
}

const answerStyle: CSSProperties = {
  marginTop: '8px',
  borderRadius: '10px',
  border: '1px solid #1a5a42',
  background: '#0a1b14',
  color: '#b8ffd8',
  padding: '8px',
  fontSize: '12px',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
}

const sendToActiveTab = (message: ExtensionMessage): Promise<boolean> =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: Array<{ id?: number }>) => {
      const tabId = tabs[0]?.id
      if (typeof tabId !== 'number') {
        resolve(false)
        return
      }

      chrome.tabs.sendMessage(tabId, message, () => {
        resolve(!chrome.runtime.lastError)
      })
    })
  })

const readAutoOpenSetting = async (): Promise<boolean> =>
  new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEYS.AUTO_OPEN], (result: Record<string, unknown>) => {
      const autoOpenValue = result[STORAGE_KEYS.AUTO_OPEN]
      resolve(typeof autoOpenValue === 'boolean' ? autoOpenValue : DEFAULT_AUTO_OPEN)
    })
  })

const readActiveTabContext = async (): Promise<{ pageTitle?: string; pageUrl?: string }> =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: Array<{ title?: string; url?: string }>) => {
      const tab = tabs[0]
      resolve({
        pageTitle: typeof tab?.title === 'string' ? tab.title : undefined,
        pageUrl: typeof tab?.url === 'string' ? tab.url : undefined,
      })
    })
  })

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

      resolve(response?.answer ?? 'No response from SLM placeholder.')
    })
  })

const PopupApp = () => {
  const [autoOpen, setAutoOpen] = useState(DEFAULT_AUTO_OPEN)
  const [status, setStatus] = useState('Ready.')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)
  const controlsRef = useRef<HTMLElement | null>(null)
  const quickAskRef = useRef<HTMLElement | null>(null)
  const statusRef = useRef<HTMLParagraphElement | null>(null)
  const answerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const sections = [controlsRef.current, quickAskRef.current].filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    )
    const timeline = gsap.timeline()
    timeline.fromTo(root, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' })
    timeline.fromTo(sections, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.22, stagger: 0.08 }, '-=0.1')

    return () => {
      timeline.kill()
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    void (async () => {
      const setting = await readAutoOpenSetting()
      if (isMounted) {
        setAutoOpen(setting)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const statusElement = statusRef.current
    if (!statusElement) {
      return
    }

    gsap.fromTo(statusElement, { opacity: 0.7, y: 3 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' })
  }, [status])

  useEffect(() => {
    const answerElement = answerRef.current
    if (!answerElement || !answer) {
      return
    }

    gsap.fromTo(answerElement, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' })
  }, [answer])

  const updateAutoOpen = (nextValue: boolean): void => {
    setAutoOpen(nextValue)
    chrome.storage.sync.set({ [STORAGE_KEYS.AUTO_OPEN]: nextValue })
  }

  const openMiniWindow = async (): Promise<void> => {
    const ok = await sendToActiveTab({
      type: MESSAGE_TYPES.OPEN_PANEL,
      payload: { focusInput: true },
    })
    setStatus(ok ? 'Mini context opened in active tab.' : 'Open an LLM tab, then try again.')
  }

  const toggleMiniWindow = async (): Promise<void> => {
    const ok = await sendToActiveTab({ type: MESSAGE_TYPES.TOGGLE_PANEL })
    setStatus(ok ? 'Mini context toggled.' : 'Open an LLM tab, then try again.')
  }

  const submitQuestion = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion || isAsking) {
      return
    }

    setIsAsking(true)
    setStatus('Querying SLM placeholder...')

    try {
      const tabContext = await readActiveTabContext()
      const result = await askSlm({
        prompt: trimmedQuestion,
        pageTitle: tabContext.pageTitle,
        pageUrl: tabContext.pageUrl,
      })
      setAnswer(result)
      setStatus('SLM placeholder answered.')
    } catch (submitError) {
      const errorMessage =
        submitError instanceof Error ? submitError.message : 'SLM placeholder failed to answer.'
      setStatus(errorMessage)
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <main ref={rootRef} style={popupRootStyle}>
      <h1 style={{ margin: '0 0 10px', fontSize: '16px' }}>Mini Context Control</h1>
      <section ref={controlsRef} style={cardStyle}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            style={smallButtonStyle}
            onClick={openMiniWindow}
            onMouseEnter={(event) => animateHoverIn(event.currentTarget)}
            onMouseLeave={(event) => animateHoverOut(event.currentTarget)}
          >
            Open mini window
          </button>
          <button
            type="button"
            style={smallButtonStyle}
            onClick={toggleMiniWindow}
            onMouseEnter={(event) => animateHoverIn(event.currentTarget)}
            onMouseLeave={(event) => animateHoverOut(event.currentTarget)}
          >
            Toggle
          </button>
        </div>
        <label style={{ marginTop: '10px', display: 'block', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={autoOpen}
            onChange={(event) => updateAutoOpen(event.target.checked)}
            style={{ marginRight: '6px' }}
          />
          Auto-open on supported LLM pages
        </label>
        <p ref={statusRef} style={{ margin: '10px 0 0', fontSize: '11px', color: '#a8b5e8' }}>
          Status: {status}
        </p>
      </section>

      <section ref={quickAskRef} style={{ ...cardStyle, marginTop: '12px' }}>
        <div style={{ fontSize: '12px', color: '#a8b5e8' }}>Quick side question</div>
        <form onSubmit={submitQuestion}>
          <textarea
            style={textAreaStyle}
            value={question}
            placeholder="Ask a minor question here..."
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button
            type="submit"
            style={askButtonStyle}
            disabled={isAsking}
            onMouseEnter={(event) => animateHoverIn(event.currentTarget)}
            onMouseLeave={(event) => animateHoverOut(event.currentTarget)}
          >
            {isAsking ? 'Thinking...' : 'Ask SLM'}
          </button>
        </form>
        {answer ? (
          <div ref={answerRef} style={answerStyle}>
            {answer}
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default PopupApp

