import { DEFAULT_AUTO_OPEN, STORAGE_KEYS } from '../shared/constants'
import {
  MESSAGE_TYPES,
  type AskSlmPayload,
  type AskSlmResponse,
  type ExtensionMessage,
} from '../shared/messages'

const ensureDefaultSettings = (): void => {
  chrome.storage.sync.get([STORAGE_KEYS.AUTO_OPEN], (result: Record<string, unknown>) => {
    if (typeof result[STORAGE_KEYS.AUTO_OPEN] === 'boolean') {
      return
    }

    chrome.storage.sync.set({
      [STORAGE_KEYS.AUTO_OPEN]: DEFAULT_AUTO_OPEN,
    })
  })
}

const sendMessageToActiveTab = (message: ExtensionMessage): void => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs: Array<{ id?: number }>) => {
    const tabId = tabs[0]?.id
    if (typeof tabId !== 'number') {
      return
    }

    chrome.tabs.sendMessage(tabId, message)
  })
}

const clip = (value: string, maxLength: number): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value

const buildStubAnswer = (payload: AskSlmPayload): string => {
  const prompt = payload.prompt ?? ''
  const trimmedPrompt = prompt.trim()
  const trimmedContext = payload.contextSnippet?.trim() ?? ''

  if (!trimmedPrompt) {
    return 'Ask a short side question and this mini context window will return a focused answer.'
  }

  const contextLine = trimmedContext
    ? `Context used: "${clip(trimmedContext, 220)}"`
    : 'Context used: none (direct question mode).'

  const sourceLine = payload.pageTitle
    ? `From tab: ${clip(payload.pageTitle, 90)}`
    : payload.pageUrl
      ? `From tab URL: ${clip(payload.pageUrl, 90)}`
      : 'From tab: unknown'

  return [
    `Quick side-answer (SLM placeholder): "${clip(trimmedPrompt, 180)}"`,
    '',
    contextLine,
    sourceLine,
    '',
    'Swap this responder with your real SLM endpoint in src/background/index.ts.',
  ].join('\n')
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultSettings()
})

chrome.commands.onCommand.addListener((command: string) => {
  if (command !== 'toggle-mini-context') {
    return
  }

  sendMessageToActiveTab({ type: MESSAGE_TYPES.TOGGLE_PANEL })
})

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage<AskSlmPayload>,
    _sender: unknown,
    sendResponse: (response: AskSlmResponse) => void,
  ) => {
    if (message.type !== MESSAGE_TYPES.ASK_SLM) {
      return
    }

    const payload: AskSlmPayload = {
      prompt: typeof message.payload?.prompt === 'string' ? message.payload.prompt : '',
      contextSnippet:
        typeof message.payload?.contextSnippet === 'string' ? message.payload.contextSnippet : undefined,
      pageTitle: typeof message.payload?.pageTitle === 'string' ? message.payload.pageTitle : undefined,
      pageUrl: typeof message.payload?.pageUrl === 'string' ? message.payload.pageUrl : undefined,
    }

    sendResponse({ answer: buildStubAnswer(payload) })
  },
)
