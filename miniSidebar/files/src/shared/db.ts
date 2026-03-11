import Dexie, { type Table } from 'dexie'

export interface Chat {
  id: string
  title: string
  updatedAt: number
  contextSnippet: string
  pageUrl?: string
  pageTitle?: string
}

export interface ChatMessage {
  id: string
  chatId: string
  role: 'you' | 'slm'
  text: string
  createdAt: number
}

export class MiniContextDB extends Dexie {
  chats!: Table<Chat>
  messages!: Table<ChatMessage>

  constructor() {
    super('MiniContextDB')
    this.version(1).stores({
      chats: 'id, updatedAt', // Primary key and indexed props
      messages: 'id, chatId, role, createdAt' // Primary key and indexed props
    })
  }
}

export const db = new MiniContextDB()
