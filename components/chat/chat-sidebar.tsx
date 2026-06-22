"use client"

import { MessageSquare, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ConversationListItem } from "@/lib/agent/chat-types"

type Props = {
  conversations: ConversationListItem[]
  currentId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
  }
  return `${d.getMonth() + 1}-${d.getDate()}`
}

export function ChatSidebar({
  conversations, currentId, onSelect, onCreate, onDelete,
}: Props) {
  return (
    <div className="w-56 shrink-0 border-r border-border flex flex-col bg-muted/30">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-sm font-medium">会话</span>
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-3.5 w-3.5" />
          新建
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {conversations.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8">暂无会话</div>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={cn(
              "group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-l-2 transition-colors",
              conv.id === currentId
                ? "border-l-primary bg-primary/5"
                : "border-l-transparent hover:bg-muted/50"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{conv.title}</div>
              <div className="text-[10px] text-muted-foreground">{formatTime(conv.updatedAt)}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-600"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
