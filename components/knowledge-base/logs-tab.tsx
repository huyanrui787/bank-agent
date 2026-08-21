"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, RefreshCw, Eye, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type Summary = {
  docNum: number; chunkNum: number; tokenNum: number
  status: { unstart: number; running: number; cancel: number; done: number; fail: number }
}
type LogItem = {
  id: string
  documentId: string
  documentName: string
  sourceFrom?: string
  pipelineTitle: string
  processBeginAt?: string
  processDuration?: number
  taskType: string
  operationStatus: string
  progressMsg?: string
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  UNSTART: { label: "待解析", className: "bg-gray-100 text-gray-600" },
  RUNNING: { label: "解析中", className: "bg-blue-100 text-blue-700" },
  CANCEL: { label: "已取消", className: "bg-gray-100 text-gray-500" },
  DONE: { label: "成功", className: "bg-green-100 text-green-700" },
  FAIL: { label: "失败", className: "bg-red-100 text-red-700" },
  "0": { label: "待解析", className: "bg-gray-100 text-gray-600" },
  "1": { label: "解析中", className: "bg-blue-100 text-blue-700" },
  "2": { label: "已取消", className: "bg-gray-100 text-gray-500" },
  "3": { label: "成功", className: "bg-green-100 text-green-700" },
  "4": { label: "失败", className: "bg-red-100 text-red-700" },
  "5": { label: "已排程", className: "bg-gray-100 text-gray-600" },
}

function fmtTime(t?: string) {
  if (!t) return ""
  const d = new Date(t)
  return isNaN(d.getTime()) ? t : d.toLocaleString()
}

function fmtDuration(sec?: number) {
  if (!sec || sec <= 0) return ""
  if (sec < 60) return `${Math.round(sec)} 秒`
  if (sec < 3600) return `${(sec / 60).toFixed(1)} 分钟`
  return `${(sec / 3600).toFixed(1)} 小时`
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, className: "bg-gray-100 text-gray-600" }
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.className}`}>{s.label}</span>
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
            <SelectItem value="DONE">成功</SelectItem>
            <SelectItem value="FAIL">失败</SelectItem>
            <SelectItem value="RUNNING">解析中</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={fetchLogs} className="ml-auto">
          <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">ID</TableHead>
            {logType === "file" && <TableHead>文件名</TableHead>}
            {logType === "file" && <TableHead className="w-24">来源</TableHead>}
            {logType === "file" && <TableHead className="w-32">数据管线</TableHead>}
            <TableHead className="w-36">开始时间</TableHead>
            <TableHead className="w-28">{logType === "file" ? "任务类型" : "处理类型"}</TableHead>
            <TableHead className="w-20">状态</TableHead>
            <TableHead className="w-16 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fetching ? (
            <TableRow>
              <TableCell colSpan={logType === "file" ? 8 : 5} className="h-24 text-center">
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> 加载日志…</span>
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={logType === "file" ? 8 : 5}>
                <TableEmpty>暂无解析日志</TableEmpty>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-muted-foreground font-mono">{log.id}</TableCell>
                {logType === "file" && (
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs max-w-[240px] truncate">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{log.documentName || "—"}</span>
                    </span>
                  </TableCell>
                )}
                {logType === "file" && (
                  <TableCell className="text-xs text-muted-foreground">{log.sourceFrom && log.sourceFrom !== "" && log.sourceFrom !== "local" ? log.sourceFrom : "本地上传"}</TableCell>
                )}
                {logType === "file" && (
                  <TableCell className="text-xs">{log.pipelineTitle === "naive" || !log.pipelineTitle ? "general" : log.pipelineTitle}</TableCell>
                )}
                <TableCell className="text-xs text-muted-foreground">{fmtTime(log.processBeginAt)}</TableCell>
                <TableCell className="text-xs">{log.taskType || "—"}</TableCell>
                <TableCell><StatusBadge status={log.operationStatus} /></TableCell>
                <TableCell className="text-right">
                  <button onClick={() => setDetail(log)} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="查看详情"><Eye className="h-3.5 w-3.5" /></button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>日志详情</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>文件名：{detail?.documentName || "—"}</span>
              <span>任务类型：{detail?.taskType || "—"}</span>
              <span>状态：<StatusBadge status={detail?.operationStatus ?? ""} /></span>
              <span>开始时间：{fmtTime(detail?.processBeginAt)}</span>
              {detail?.processDuration != null && <span>时长：{fmtDuration(detail.processDuration)}</span>}
            </div>
            {detail?.progressMsg && (
              <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded p-3 max-h-80 overflow-y-auto">{detail.progressMsg}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
