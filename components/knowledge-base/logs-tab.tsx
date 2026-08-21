"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type Summary = {
  docNum: number; chunkNum: number; tokenNum: number
  status: { unstart: number; running: number; cancel: number; done: number; fail: number }
}
type LogItem = { id: string; operationStatus: string; logType: string; createTime?: string; message?: string }

function fmtTime(t?: string) {
  if (!t) return ""
  const d = new Date(t)
  return isNaN(d.getTime()) ? t : d.toLocaleString()
}

export function LogsTab({ datasetId }: { datasetId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [fetching, setFetching] = useState(true)

  const fetchLogs = useCallback(async () => {
    try {
      const [sRes, lRes] = await Promise.all([
        fetch(`/api/knowledge-base/datasets/${datasetId}/ingestions/summary`),
        fetch(`/api/knowledge-base/datasets/${datasetId}/ingestions?page=1&page_size=20`),
      ])
      if (sRes.ok) { const d = await sRes.json(); setSummary(d.summary ?? null) }
      if (lRes.ok) { const d = await lRes.json(); setLogs(d.logs ?? []) }
    } finally { setFetching(false) }
  }, [datasetId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  if (fetching) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> 加载日志…</div>
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card><CardContent className="p-3 text-center">
            <div className="text-xl font-semibold">{summary.docNum}</div>
            <div className="text-xs text-muted-foreground">文档</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-xl font-semibold">{summary.chunkNum}</div>
            <div className="text-xs text-muted-foreground">分块</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="text-xl font-semibold">{summary.tokenNum}</div>
            <div className="text-xs text-muted-foreground">Token</div>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle className="h-3.5 w-3.5" />{summary.status.done}</span>
              <span className="inline-flex items-center gap-1 text-blue-600"><PlayCircle className="h-3.5 w-3.5" />{summary.status.running}</span>
              <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="h-3.5 w-3.5" />{summary.status.fail}</span>
            </div>
            <div className="text-xs text-muted-foreground">完成 / 解析中 / 失败</div>
          </CardContent></Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">解析日志</span>
        <Button variant="ghost" size="sm" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6">暂无解析日志</p>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs">{log.message || log.operationStatus || "—"}</span>
                  {log.logType && <span className="text-[10px] text-muted-foreground">{log.logType}</span>}
                </div>
                {log.createTime && <p className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(log.createTime)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
