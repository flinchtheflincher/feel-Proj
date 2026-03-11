/// <reference types="chrome" />
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


const queryLocalModelStream = async (payload: AskSlmPayload, tabId: number): Promise<void> => {
  const prompt = payload.prompt ?? ''
  const trimmedPrompt = prompt.trim()
  const trimmedContext = payload.contextSnippet?.trim() ?? ''
  const chatId = payload.chatId

  if (!trimmedPrompt) {
    chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.SLM_DONE, payload: { chatId } })
    return
  }

  const systemMessage = trimmedContext
    ? `You are an AI assistant in a browser extension. Use the following page context to answer the user's question:\n"""\n${trimmedContext}\n"""`
    : 'You are a helpful AI assistant in a browser extension.'

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3',
        prompt: trimmedPrompt,
        system: systemMessage,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`Local model request failed with status: ${response.status}`)
    }

    if (!response.body) throw new Error('No response body')

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
            if (data.response) {
               chrome.tabs.sendMessage(tabId, {
                 type: MESSAGE_TYPES.SLM_CHUNK,
                 payload: { chatId, text: data.response }
               })
            }
          } catch (e) {
            // ignore JSON parse error for incomplete chunks
          }
        }
      }
    }
  } catch (err: any) {
    chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.SLM_CHUNK,
      payload: { chatId, text: `\n[Error: ${err.message}]` }
    })
  } finally {
    chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.SLM_DONE, payload: { chatId } })
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultSettings()
})

chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked', tab.id);
  const tabId = tab.id;
  if (typeof tabId !== 'number') return;

  try {
    // Try sending a message first
    await chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.TOGGLE_PANEL });
    console.log('Sent TOGGLE_PANEL message to content script');
  } catch (err) {
    // If it fails, the content script might not be injected yet
    console.log('Message failed, attempting to inject content script...', err);
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      console.log('Content script injected via executeScript');
      // No need to send message here as mountMiniContext handles initial render
    } catch (injectErr) {
      console.error('Failed to inject content script:', injectErr);
    }
  }
});

chrome.commands.onCommand.addListener((command: string) => {
  if (command !== 'toggle-mini-context') {
    return
  }

  sendMessageToActiveTab({ type: MESSAGE_TYPES.TOGGLE_PANEL })
})

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage<AskSlmPayload>,
    sender: chrome.runtime.MessageSender,
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
