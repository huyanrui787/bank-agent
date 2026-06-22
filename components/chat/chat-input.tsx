"use client"

import { useState } from "react"
import { Send, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { BUILTIN_SKILLS } from "@/lib/agent/skill-store"

const quickPrompts = [
  "梳理 高新区·锦园 中日均存款大于 10 万元的客户清单",
  "扫描本月所有业务预警",
  "分析 张明 的风险情况，并生成调查报告",
  "统计各客户经理本月新增存款客户",
]

type Props = {
  onSend: (text: string) => void
  loading?: boolean
  loadedSkillIds?: string[]
  onUnloadSkill?: (id: string) => void
}

export function ChatInput({ onSend, loading, loadedSkillIds = [], onUnloadSkill }: Props) {
  const [value, setValue] = useState("")

  function handleSend(text?: string) {
    const msg = (text ?? value).trim()
    if (!msg) return
    onSend(msg)
    setValue("")
  }

  const hasSkills = loadedSkillIds.length > 0

  return (
    <div className="shrink-0 border-t border-border p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {hasSkills && (
          <>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-primary font-medium">Skill</span>
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {loadedSkillIds.map((id) => {
                const skill = BUILTIN_SKILLS.find((s) => s.id === id)
                if (!skill) return null
                return (
                  <button
                    key={id}
                    onClick={() => onUnloadSkill?.(id)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                  >
                    {skill.name}
                    <X className="h-3 w-3" />
                  </button>
                )
              })}
            </div>
            <div className="h-3.5 w-px bg-border shrink-0" />
          </>
        )}

        <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
          <Sparkles className="h-3 w-3" />快捷指令
        </span>
        {quickPrompts.map((p) => (
          <button key={p} onClick={() => handleSend(p)} disabled={loading} className="text-xs">
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">
              {p}
            </Badge>
          </button>
        ))}
      </div>

      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="描述你的需求，Enter 发送"
          className="min-h-20 pr-20 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <Button
          onClick={() => handleSend()}
          disabled={loading || !value.trim()}
          className="absolute bottom-3 right-3"
          size="sm"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
