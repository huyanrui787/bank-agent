import type { Conversation, ConversationListItem } from "./chat-types"
import { randomId } from "@/lib/utils"

const INDEX_KEY = "ai-workbench-conv-index"
const CONV_PREFIX = "ai-workbench-conv-"
const MAX_CONVERSATIONS = 50

export function loadConversationList(): ConversationListItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function loadConversation(id: string): Conversation | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CONV_PREFIX + id)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveConversation(conv: Conversation): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CONV_PREFIX + conv.id, JSON.stringify(conv))
  const list = loadConversationList()
  const idx = list.findIndex((c) => c.id === conv.id)
  const item: ConversationListItem = { id: conv.id, title: conv.title, updatedAt: conv.updatedAt }
  if (idx >= 0) {
    list[idx] = item
  } else {
    list.unshift(item)
  }
  list.sort((a, b) => b.updatedAt - a.updatedAt)
  if (list.length > MAX_CONVERSATIONS) {
    const removed = list.splice(MAX_CONVERSATIONS)
    removed.forEach((r) => localStorage.removeItem(CONV_PREFIX + r.id))
  }
  localStorage.setItem(INDEX_KEY, JSON.stringify(list))
}

export function deleteConversation(id: string): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(CONV_PREFIX + id)
  const list = loadConversationList().filter((c) => c.id !== id)
  localStorage.setItem(INDEX_KEY, JSON.stringify(list))
}

export function createConversation(): Conversation {
  return {
    id: randomId(),
    title: "新对话",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  }
}
