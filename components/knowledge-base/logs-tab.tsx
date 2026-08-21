"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, RefreshCw, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Summary = {
  docNum: number; chunkNum: number; tokenNum: number
  status: { unstart: number; running: number; cancel: number; done: number; fail: number }
}
type LogItem = { id: string; operationStatus: string; logType: string; createTime?: string; message?: string }

const STATUS_BADGE: Record<string, string> = {
  done: "bg-green-100 text-green-700", fail: "bg-red-100 text-red-700",
  running: "bg-blue-100 text-blue-700", unstart: "bg-gray-100 text-gray-600", cancel: "bg-gray-100 text-gray-500",
}
const STATUS_LABEL: Record<string, string> = {
  done: "完成", fail: "失败", running: "解析中", unstart: "待解析", cancel: "已取消",
}

function fmtTime(t?: string) {
  if (!t) return ""
  const d = new Date(t)
  return isNaN(d.getTime()) ? t : d.toLocaleString()
}

export function LogsTab({ datasetId }: { datasetId: string }) {
  const [logType, setLogType] = useState<"file" | "dataset">("file")
  const [statusFilter, setStatusFilter] = useState("all")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [detail, setDetail] = useState<LogItem | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const [sRes, lRes] = await Promise.all([
        fetch(`/api/knowledge-base/datasets/${datasetId}/ingestions/summary`),
        fetch(`/api/knowledge-base/datasets/${datasetId}/ingestions?page=1&page_size=100&log_type=${logType}`),
      ])
      if (sRes.ok) { const d = await sRes.json(); setSummary(d.summary ?? null) }
      if (lRes.ok) { const d = await lRes.json(); setLogs(d.logs ?? []) }
    } finally { setFetching(false) }
  }, [datasetId, logType])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const filtered = statusFilter === "all" ? logs : logs.filter((l) => l.operationStatus === statusFilter)

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">总文件数</div>
              <div className="text-3xl font-semibold mt-1">{summary.docNum}</div>
              <div className="text-xs text-muted-foreground mt-1">{summary.chunkNum} 分块 · {summary.tokenNum} Token</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">解析数</div>
              <div className="text-3xl font-semibold mt-1">{summary.status.done + summary.status.running + summary.status.fail}</div>
              <div className="flex gap-2 mt-2 text-sm">
                <div className="flex-1 flex items-center justify-between rounded px-2 py-1 bg-green-50">
                  <span className="text-xs text-muted-foreground">成功</span>
                  <span className="text-green-700 font-medium">{summary.status.done}</span>
                </div>
                <div className="flex-1 flex items-center justify-between rounded px-2 py-1 bg-red-50">
                  <span className="text-xs text-muted-foreground">失败</span>
                  <span className="text-red-700 font-medium">{summary.status.fail}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setLogType("file")}
            className={cn("px-3 py-1.5 text-xs", logType === "file" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
          >文件日志</button>
          <button
            onClick={() => setLogType("dataset")}
            className={cn("px-3 py-1.5 text-xs", logType === "dataset" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
          >知识库日志</button>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="done">完成</SelectItem>
            <SelectItem value="fail">失败</SelectItem>
            <SelectItem value="running">解析中</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={fetchLogs} className="ml-auto">
          <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {fetching ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> 加载日志…</div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6">暂无解析日志</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((log) => (
            <div key={log.id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE[log.operationStatus] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABEL[log.operationStatus] ?? log.operationStatus}
              </span>
              <span className="flex-1 min-w-0 text-xs truncate">{log.message || log.operationStatus || "—"}</span>
              {log.createTime && <span className="text-[10px] text-muted-foreground shrink-0">{fmtTime(log.createTime)}</span>}
              <button onClick={() => setDetail(log)} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground shrink-0" title="查看详情"><Eye className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>日志详情</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {detail?.message && (
              <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded p-3 max-h-80 overflow-y-auto">{detail.message}</pre>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {detail?.operationStatus && <span>状态：{STATUS_LABEL[detail.operationStatus] ?? detail.operationStatus}</span>}
              {detail?.createTime && <span>时间：{fmtTime(detail.createTime)}</span>}
              {detail?.logType && <span>类型：{detail.logType === "file" ? "文件日志" : "知识库日志"}</span>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
