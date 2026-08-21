"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Trash2, RefreshCw, Upload, FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useUser } from "@/lib/hooks/use-user"

type DocItem = {
  id: string; name: string; status: string; progress: number
  chunkCount?: number; size?: string; progressMsg?: string
}

const STATUS_LABELS: Record<string, string> = {
  UNSTART: "待解析", RUNNING: "解析中", DONE: "已完成", FAIL: "解析失败", CANCEL: "已取消",
}
const STATUS_BADGE: Record<string, string> = {
  UNSTART: "bg-gray-100 text-gray-600", RUNNING: "bg-blue-50 text-blue-700",
  DONE: "bg-green-50 text-green-700", FAIL: "bg-red-50 text-red-700", CANCEL: "bg-gray-100 text-gray-500",
}

export function DocumentsTab({ datasetId }: { datasetId: string }) {
  const { user } = useUser()
  const canManage = !!user?.permissions?.includes("manage_knowledge")
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents`)
      if (!res.ok) return
      const d = await res.json()
      setDocuments(d.documents ?? [])
    } finally { setFetching(false) }
  }, [datasetId])

  useEffect(() => { fetchDocuments() }, [fetchDocuments])
  useEffect(() => stopPolling, [stopPolling])

  function startPolling() {
    stopPolling()
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents`).catch(() => null)
      if (!res || !res.ok) return
      const d = await res.json().catch(() => null)
      const docs = (d?.documents ?? []) as DocItem[]
      setDocuments(docs)
      const busy = docs.some((x) => x.status === "RUNNING" || x.status === "UNSTART")
      if (!busy) stopPolling()
    }, 2000)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (files.length === 0) return
    setUploading(true)
    try {
      const fd = new FormData()
      for (const f of files) fd.append("file", f)
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents`, { method: "POST", body: fd })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "上传失败"); return }
      toast.success(`已上传 ${files.length} 个文件，开始解析…`)
      await fetchDocuments()
      startPolling()
    } finally { setUploading(false) }
  }

  async function handleDelete(doc: DocItem) {
    if (!confirm(`确定删除文档「${doc.name}」？`)) return
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/${doc.id}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "删除失败"); return }
    toast.success("已删除")
    await fetchDocuments()
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {uploading ? "上传中…" : "上传文档"}
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchDocuments} disabled={fetching}>
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          </Button>
          <span className="text-xs text-muted-foreground">支持 PDF / Word / TXT / Markdown 等，可多选，上传后自动解析</span>
        </div>
      )}

      {fetching && documents.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载文档…
        </div>
      ) : documents.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6">暂无文档{canManage ? "，点击「上传文档」添加" : ""}</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 rounded-md border border-border p-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm truncate">{doc.name}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </span>
                  {doc.status === "DONE" && typeof doc.chunkCount === "number" && (
                    <span className="text-[10px] text-muted-foreground">{doc.chunkCount} 分块</span>
                  )}
                  {doc.size && <span className="text-[10px] text-muted-foreground">{doc.size}</span>}
                </div>
                {(doc.status === "RUNNING" || doc.status === "UNSTART") && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={Math.round(doc.progress * 100)} className="flex-1" />
                    <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(doc.progress * 100)}%</span>
                  </div>
                )}
                {doc.status === "FAIL" && doc.progressMsg && (
                  <p className="text-[10px] text-red-500 mt-1 truncate">{doc.progressMsg}</p>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => handleDelete(doc)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
