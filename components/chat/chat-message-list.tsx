"use client"

import { useEffect, useRef } from "react"
import { Sparkles } from "lucide-react"
import { ChatMessageBubble } from "./chat-message-bubble"
import type { ChatMessage } from "@/lib/agent/chat-types"

type Props = {
  messages: ChatMessage[]
  loading?: boolean
  streamingId?: string | null
  onSendAction?: (text: string) => void
}

export function ChatMessageList({ messages, loading, streamingId, onSendAction }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, loading])

  // also scroll on content change during streaming
  const lastContent = messages[messages.length - 1]?.content
  useEffect(() => {
    if (streamingId) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [lastContent, streamingId])

  if (!messages.length && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3 max-w-md">
          <div className="flex justify-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="text-lg font-medium">AI 工作台</div>
          <p className="text-sm text-muted-foreground">
            输入业务问题或使用快捷指令，AI 会自动识别意图并调用对应技能。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
      {messages.map((msg) => (
        <ChatMessageBubble
          key={msg.id}
          message={msg}
          streaming={msg.id === streamingId}
          onSendAction={onSendAction}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
