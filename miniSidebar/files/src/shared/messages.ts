export const MESSAGE_TYPES = {
  ASK_SLM: 'ASK_SLM',
  TOGGLE_PANEL: 'TOGGLE_PANEL',
  OPEN_PANEL: 'OPEN_PANEL',
  CLOSE_PANEL: 'CLOSE_PANEL',
  SLM_CHUNK: 'SLM_CHUNK',
  SLM_DONE: 'SLM_DONE',
} as const

export type MessageTypeType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]

export interface ExtensionMessage<T = unknown> {
  type: MessageTypeType
  payload?: T
}

export interface AskSlmPayload {
  prompt: string
  contextSnippet?: string
  pageTitle?: string
  pageUrl?: string
  chatId?: string // Optional identifier for multi-chat tracking
}

export interface SlmChunkPayload {
  chatId?: string
  text: string
}

export interface SlmDonePayload {
  chatId?: string
}

export interface AskSlmResponse {
  answer: string
}
