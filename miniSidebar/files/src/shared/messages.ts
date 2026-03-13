export const MESSAGE_TYPES = {
  ASK_SLM: 'ASK_SLM',
  TOGGLE_PANEL: 'TOGGLE_PANEL',
  OPEN_PANEL: 'OPEN_PANEL',
  CLOSE_PANEL: 'CLOSE_PANEL',
  SLM_CHUNK: 'SLM_CHUNK',
  SLM_DONE: 'SLM_DONE',
  SLM_ERROR: 'SLM_ERROR',
  LIST_MODELS: 'LIST_MODELS',
  MODELS_RESULT: 'MODELS_RESULT',
  HEALTH_CHECK: 'HEALTH_CHECK',
  HEALTH_RESULT: 'HEALTH_RESULT',
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

export interface SlmErrorPayload {
  chatId?: string
  error: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ListModelsPayload {
  // empty — request only
}

export interface ModelsResultPayload {
  models: string[]
  error?: string
}

export interface HealthResultPayload {
  online: boolean
  error?: string
}
