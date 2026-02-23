export const MESSAGE_TYPES = {
  TOGGLE_PANEL: 'mini_context_toggle_panel',
  OPEN_PANEL: 'mini_context_open_panel',
  CLOSE_PANEL: 'mini_context_close_panel',
  ASK_SLM: 'mini_context_ask_slm',
} as const

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES]

export interface ExtensionMessage<TPayload = unknown> {
  type: MessageType
  payload?: TPayload
}

export interface AskSlmPayload {
  prompt: string
  contextSnippet?: string
  pageTitle?: string
  pageUrl?: string
}

export interface AskSlmResponse {
  answer: string
}
