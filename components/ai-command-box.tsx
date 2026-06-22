"use client"

import { useState } from "react"
import { Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import type { AgentResponse } from "@/lib/agent/types"

const quickPrompts = [
  "梳理 高新区·锦园 中日均存款大于 10 万元的客户清单",
  "扫描本月所有业务预警",
  "分析 张明 的风险情况，并生成调查报告",
  "统计各客户经理本月新增存款客户",
]

type Props = {
  onResult: (data: AgentResponse, input: string) => void
  onLoading?: (loading: boolean) => void
  loading?: boolean
}

export function AiCommandBox({ onResult, onLoading, loading }: Props) {
  const [value, setValue] = useState("")

  async function execute(message?: string) {
    const text = (message ?? value).trim()
    if (!text) return
    setValue(text)
    onLoading?.(true)
    try {
      const res = await fetch("/api/mock-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      })
      const data = (await res.json()) as AgentResponse
      onResult(data, text)
    } finally {
      onLoading?.(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="试着问：『梳理 高新区·锦园 中日均存款大于 10 万的客户清单』"
          className="min-h-28 pr-28 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              execute()
            }
          }}
        />
        <Button
          onClick={() => execute()}
          disabled={loading || !value.trim()}
          className="absolute bottom-3 right-3"
          size="sm"
        >
          {loading ? "执行中…" : (
            <>
              <Send className="h-3.5 w-3.5" />
              执行
            </>
          )}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />快捷指令
        </span>
        {quickPrompts.map((p) => (
          <button
            key={p}
            onClick={() => execute(p)}
            disabled={loading}
            className="text-xs"
          >
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">
              {p}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  )
}
