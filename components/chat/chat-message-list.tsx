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
            既能查询客户、预警、绩效等经营数据，也能咨询利率、合规、准入、贷前调查等政策知识。
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 rounded-full bg-muted/50">📊 数据查询</span>
            <span className="px-2 py-1 rounded-full bg-muted/50">📖 政策知识</span>
          </div>
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
