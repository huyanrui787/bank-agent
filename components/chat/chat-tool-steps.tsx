"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Circle, Loader2 } from "lucide-react"
import type { AgentStep } from "@/lib/agent/types"
import { cn } from "@/lib/utils"

const iconMap = {
  done: { icon: CheckCircle2, className: "text-emerald-600" },
  running: { icon: Loader2, className: "text-primary animate-spin" },
  pending: { icon: Circle, className: "text-muted-foreground" },
  error: { icon: AlertCircle, className: "text-red-600" },
} as const

type Props = {
  steps: AgentStep[]
  streaming?: boolean
}

export function ChatToolSteps({ steps, streaming }: Props) {
  const allDone = !streaming && steps.every((s) => s.status === "done")
  const [expanded, setExpanded] = useState(true)

  if (!steps.length && !streaming) return null

  const doneCount = steps.filter((s) => s.status === "done").length
  const total = steps.length

  return (
    <div className="rounded-md border border-border bg-muted/30 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="font-medium">工具调用</span>
        {streaming ? (
          <span className="text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            执行中…
          </span>
        ) : (
          <span className="text-muted-foreground">{doneCount}/{total} 完成</span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-1.5">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1
            const effectiveStatus = streaming && isLast ? "running" : step.status
            const conf = iconMap[effectiveStatus] ?? iconMap.pending
            const Icon = conf.icon
            return (
              <div key={step.id} className="flex items-start gap-2">
                <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", conf.className)} />
                <div>
                  <span className="font-medium">{step.title}</span>
                  <span className="text-muted-foreground ml-1.5">{step.description}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
