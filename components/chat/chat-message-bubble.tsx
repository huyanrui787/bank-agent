"use client"

import { Sparkles, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ChatToolSteps } from "./chat-tool-steps"
import { AgentResultBlock } from "./agent-result-block"
import type { ChatMessage } from "@/lib/agent/chat-types"

type Props = {
  message: ChatMessage
  streaming?: boolean
  onSendAction?: (text: string) => void
}

export function ChatMessageBubble({ message, streaming, onSendAction }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-2 max-w-[80%]">
          <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm">
            {message.content}
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>
    )
  }

  const hasContent = !!message.content
  const hasSteps = message.steps && message.steps.length > 0

  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 max-w-[85%]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="space-y-3 min-w-0 flex-1">
          {hasSteps && (
            <ChatToolSteps steps={message.steps!} streaming={streaming} />
          )}

          {(hasContent || streaming) && (
            <div className="text-sm text-foreground">
              {message.content}
              {streaming && (
                <span className="inline-block w-0.5 h-4 bg-foreground/70 ml-0.5 align-middle animate-blink" />
              )}
            </div>
          )}

          {!streaming && message.response && message.response.resultType !== "empty" && (
            <AgentResultBlock response={message.response} />
          )}

          {!streaming && message.response?.suggestedNextActions && message.response.suggestedNextActions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {message.response.suggestedNextActions.map((action) => (
                <Badge
                  key={action}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs"
                  onClick={() => onSendAction?.(action)}
                >
                  {action}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
