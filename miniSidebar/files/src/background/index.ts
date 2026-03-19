/// <reference types="chrome" />
import { DEFAULT_MODEL, OLLAMA_BASE_URL, STORAGE_KEYS } from '../shared/constants'
import {
  MESSAGE_TYPES,
  type AskSlmPayload,
  type AskSlmResponse,
  type ExtensionMessage,
  type HealthResultPayload,
  type ModelsResultPayload,
} from '../shared/messages'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ensureDefaultSettings = (): void => {
  chrome.storage.sync.get([STORAGE_KEYS.SELECTED_MODEL], (result: Record<string, unknown>) => {
    if (typeof result[STORAGE_KEYS.SELECTED_MODEL] !== 'string') {
      chrome.storage.sync.set({ [STORAGE_KEYS.SELECTED_MODEL]: DEFAULT_MODEL })
    }
  })
}

const getSelectedModel = (): Promise<string> =>
  new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEYS.SELECTED_MODEL], (result: Record<string, unknown>) => {
      const model = result[STORAGE_KEYS.SELECTED_MODEL]
      resolve(typeof model === 'string' ? model : DEFAULT_MODEL)
    })
  })

const sendMessageToActiveTab = (message: ExtensionMessage): void => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs: Array<{ id?: number }>) => {
    const tabId = tabs[0]?.id
    if (typeof tabId !== 'number') return
    chrome.tabs.sendMessage(tabId, message)
  })
}

// Track active AbortControllers so we can cancel ongoing requests
const activeRequests = new Map<string, AbortController>()
const REQUEST_TIMEOUT_MS = 60_000

// ── Ollama API ───────────────────────────────────────────────────────────────

const queryLocalModelStream = async (payload: AskSlmPayload, tabId: number): Promise<void> => {
  const prompt = payload.prompt?.trim() ?? ''
  const context = payload.contextSnippet?.trim() ?? ''
  const chatId = payload.chatId ?? ''

  if (!prompt) {
    chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.SLM_DONE, payload: { chatId } })
    return
  }

  // Cancel any previous request for this chat
  activeRequests.get(chatId)?.abort()

  const controller = new AbortController()
  activeRequests.set(chatId, controller)

  // Timeout auto-abort
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  const model = await getSelectedModel()

  const systemMessage = context
    ? `You are a helpful AI assistant. Use the following page context to answer the user's question naturally:\n"""\n${context}\n"""`
    : 'You are a helpful AI assistant. Answer the user\'s questions naturally and concisely.'

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt },
        ],
        stream: true,
      }),
    })

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Ollama returned 403 Forbidden. This is likely a CORS issue. Please set OLLAMA_ORIGINS="chrome-extension://*" and restart Ollama.')
      }
      throw new Error(`Ollama returned ${response.status}: ${response.statusText}`)
    }
    if (!response.body) throw new Error('No response body from Ollama')

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let done = false

    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        const chunkStr = decoder.decode(value, { stream: true })
        const lines = chunkStr.split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const data = JSON.parse(line)
            const text = data.message?.content
            if (text) {
              console.log('[Background] Sending SLM_CHUNK:', { chatId, textLen: text.length });
              chrome.tabs.sendMessage(tabId, {
                type: MESSAGE_TYPES.SLM_CHUNK,
                payload: { chatId, text },
              })
            }
          } catch {
            // incomplete JSON chunk — skip
          }
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.SLM_CHUNK,
        payload: { chatId, text: '\n[Request cancelled]' },
      })
    } else {
      const errMsg = err instanceof Error ? err.message : String(err)
      const msg = errMsg.includes('Failed to fetch') || errMsg.includes('ECONNREFUSED')
        ? 'Cannot connect to Ollama. Is it running on localhost:11434?'
        : errMsg
      chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.SLM_ERROR,
        payload: { chatId, error: msg },
      })
    }
  } finally {
    clearTimeout(timeout)
    activeRequests.delete(chatId)
    chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.SLM_DONE, payload: { chatId } })
  }
}

const listModels = async (): Promise<ModelsResultPayload> => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Ollama returned 403 Forbidden (CORS error)')
      }
      throw new Error(`Status ${response.status}`)
    }
    const data = await response.json()
    const models: string[] = (data.models ?? []).map((m: Record<string, unknown>) => String(m.name ?? m.model ?? ''))
      .filter((n: string) => n.length > 0)
    return { models }
  } catch (err: unknown) {
    return { models: [], error: err instanceof Error ? err.message : String(err) }
  }
}

const healthCheck = async (): Promise<HealthResultPayload> => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/`, { method: 'GET' })
    return { online: response.ok }
  } catch {
    return { online: false, error: 'Cannot reach Ollama' }
  }
}

// ── Event Listeners ──────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultSettings()
})

chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id
  if (typeof tabId !== 'number') return

  console.log('Extension icon clicked on tab:', tabId);

  try {
    // Try sending OPEN_PANEL instead of just TOGGLE to ensure it shows up if it was hidden
    await chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.OPEN_PANEL, payload: { focusInput: true } })
  } catch (err) {
    console.log('Content script not responding, attempting injection...', err);
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      })
      // Since we changed DEFAULT_AUTO_OPEN to false, we must explicitly send the open message
      // after injection. We add a small delay to ensure the content script has initialized its listener.
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.OPEN_PANEL, payload: { focusInput: true } }).catch(() => {})
      }, 200)
    } catch (injectErr) {
      console.error('Failed to inject content script:', injectErr)
    }
  }
})

chrome.commands.onCommand.addListener((command: string) => {
  if (command !== 'toggle-mini-context') return
  sendMessageToActiveTab({ type: MESSAGE_TYPES.TOGGLE_PANEL })
})

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage<AskSlmPayload>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: AskSlmResponse | ModelsResultPayload | HealthResultPayload) => void,
  ) => {
    // ── Model list request ──
    if (message.type === MESSAGE_TYPES.LIST_MODELS) {
      listModels().then(sendResponse).catch(() => sendResponse({ models: [], error: 'Unknown error' }))
      return true
    }

    // ── Health check request ──
    if (message.type === MESSAGE_TYPES.HEALTH_CHECK) {
      healthCheck().then(sendResponse).catch(() => sendResponse({ online: false, error: 'Unknown error' }))
      return true
    }

    // ── LLM query ──
    if (message.type !== MESSAGE_TYPES.ASK_SLM) return

    const payload: AskSlmPayload = {
      prompt: typeof message.payload?.prompt === 'string' ? message.payload.prompt : '',
      contextSnippet: typeof message.payload?.contextSnippet === 'string' ? message.payload.contextSnippet : undefined,
      pageTitle: typeof message.payload?.pageTitle === 'string' ? message.payload.pageTitle : undefined,
      pageUrl: typeof message.payload?.pageUrl === 'string' ? message.payload.pageUrl : undefined,
      chatId: typeof message.payload?.chatId === 'string' ? message.payload.chatId : undefined,
    }

    const tabId = sender.tab?.id
    if (tabId) {
      queryLocalModelStream(payload, tabId).catch(console.error)
    }

    sendResponse({ answer: 'Stream started' })
    return true
  },
)
