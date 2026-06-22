import type { AgentStep, AgentResponse } from "./types"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  steps?: AgentStep[]
  response?: AgentResponse
}

export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

export type ConversationListItem = {
  id: string
  title: string
  updatedAt: number
}
