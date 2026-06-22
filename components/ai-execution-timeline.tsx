import { AlertCircle, CheckCircle2, Circle, Loader2 } from "lucide-react"
import type { AgentStep } from "@/lib/agent/types"
import { cn } from "@/lib/utils"

const iconMap = {
  done: { icon: CheckCircle2, className: "text-emerald-600" },
  running: { icon: Loader2, className: "text-primary spin-slow" },
  pending: { icon: Circle, className: "text-muted-foreground" },
  error: { icon: AlertCircle, className: "text-red-600" },
} as const

export function AiExecutionTimeline({ steps, empty }: { steps: AgentStep[]; empty?: string }) {
  if (!steps.length) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground py-10">
        {empty ?? "等待 AI 执行任务..."}
      </div>
    )
  }
  return (
    <ol className="space-y-3 fade-in">
      {steps.map((step, i) => {
        const conf = iconMap[step.status] ?? iconMap.pending
        const Icon = conf.icon
        const last = i === steps.length - 1
        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Icon className={cn("h-4 w-4 mt-0.5", conf.className)} />
              {!last ? <div className="flex-1 w-px bg-border my-1" /> : null}
            </div>
            <div className="flex-1 pb-1">
              <div className="text-sm font-medium leading-tight">{step.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{step.description}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
