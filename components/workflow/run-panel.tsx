"use client"

import { X, Play, StopCircle, CheckCircle, XCircle, Loader2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { WorkflowRunEvent } from "@/lib/workflow/types"

export function RunPanel({
  running, runInput, onInputChange, onRun, onClose, log,
}: {
  running: boolean
  runInput: string
  onInputChange: (v: string) => void
  onRun: () => void
  onClose: () => void
  log: WorkflowRunEvent[]
}) {
  const lastDone = log.find((e) => e.type === "flow_done")
  const finalResults = lastDone?.type === "flow_done" ? lastDone.results : []

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">运行工作流</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="p-4 space-y-3 border-b border-border">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">输入内容</label>
          <Input
            value={runInput}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="如：张明"
            disabled={running}
          />
        </div>
        <Button size="sm" className="w-full" onClick={onRun}>
          {running
            ? <><StopCircle className="h-4 w-4 mr-1.5" /> 停止运行</>
            : <><Play className="h-4 w-4 mr-1.5" /> 开始运行</>}
        </Button>
      </div>

      {/* Log */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {log.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">运行后此处显示执行日志</p>
        )}
        {log.map((event, i) => (
          <LogItem key={i} event={event} />
        ))}
        {running && (
          <div className="flex items-center gap-2 text-xs text-amber-600 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" /> 执行中…
          </div>
        )}
        {finalResults.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-medium mb-2">执行结果</p>
            {finalResults.map((r) => (
              <div key={r.nodeId} className="text-xs space-y-0.5 mb-2">
                <div className="flex items-center gap-1.5">
                  {r.status === "done" ? <CheckCircle className="h-3 w-3 text-green-600 shrink-0" /> : r.status === "error" ? <XCircle className="h-3 w-3 text-red-600 shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                  <span className="text-muted-foreground">{r.nodeId}</span>
                  {r.durationMs && <span className="text-muted-foreground ml-auto">{r.durationMs}ms</span>}
                </div>
                {r.output !== undefined && r.output !== null && (
                  <pre className="ml-5 text-[10px] bg-muted/50 rounded p-1.5 whitespace-pre-wrap max-h-24 overflow-auto">
                    {typeof r.output === "string" ? r.output.slice(0, 200) : JSON.stringify(r.output, null, 2).slice(0, 200)}
                  </pre>
                )}
                {r.error && <p className="ml-5 text-[10px] text-red-600">{r.error}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LogItem({ event }: { event: WorkflowRunEvent }) {
  if (event.type === "node_start") return (
    <div className="flex items-center gap-1.5 text-xs text-amber-600">
      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
      <span>运行 <strong>{event.label}</strong></span>
    </div>
  )
  if (event.type === "node_done") return (
    <div className="flex items-center gap-1.5 text-xs text-green-600">
      <CheckCircle className="h-3 w-3 shrink-0" />
      <span><strong>{event.nodeId}</strong> 完成 ({event.durationMs}ms)</span>
    </div>
  )
  if (event.type === "node_error") return (
    <div className="flex items-center gap-1.5 text-xs text-red-600">
      <XCircle className="h-3 w-3 shrink-0" />
      <span><strong>{event.nodeId}</strong> 出错：{event.error.slice(0, 80)}</span>
    </div>
  )
  if (event.type === "flow_done") return (
    <div className="text-xs text-muted-foreground border-t border-border pt-1.5 mt-1">
      ✓ 工作流执行完成，共 {event.results.length} 个节点
    </div>
  )
  if (event.type === "flow_error") return (
    <div className="text-xs text-red-600">工作流出错：{event.error}</div>
  )
  return null
}
