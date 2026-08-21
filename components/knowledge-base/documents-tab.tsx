"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Plus, Trash2, RefreshCw, Upload, FileText, Loader2, Download, Pencil, FolderUp, ArrowUpDown, CircleStop } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useUser } from "@/lib/hooks/use-user"
import { ChunkViewer } from "./chunk-viewer"

type DocItem = {
  id: string; name: string; status: string; progress: number
  chunkCount?: number; size?: string; progressMsg?: string; enabled?: number; createTime?: string
}

const STATUS_LABELS: Record<string, string> = {
  UNSTART: "待解析", RUNNING: "解析中", DONE: "已完成", FAIL: "解析失败", CANCEL: "已取消",
}
const STATUS_BADGE: Record<string, string> = {
  UNSTART: "bg-gray-100 text-gray-600", RUNNING: "bg-blue-50 text-blue-700",
  DONE: "bg-green-50 text-green-700", FAIL: "bg-red-50 text-red-700", CANCEL: "bg-gray-100 text-gray-500",
}

function fmtTime(t?: string) {
  if (!t) return ""
  const d = new Date(t)
  return isNaN(d.getTime()) ? t : d.toLocaleDateString()
}

export function DocumentsTab({ datasetId }: { datasetId: string }) {
  const { user } = useUser()
  const canManage = !!user?.permissions?.includes("manage_knowledge")
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortField, setSortField] = useState<"name" | "createTime">("createTime")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renameTarget, setRenameTarget] = useState<DocItem | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [emptyOpen, setEmptyOpen] = useState(false)
  const [emptyName, setEmptyName] = useState("")
  const [reparseTarget, setReparseTarget] = useState<DocItem[] | null>(null)
  const [reparseDelete, setReparseDelete] = useState(false)
  const [reparseApplyKb, setReparseApplyKb] = useState(false)
  const [chunkDoc, setChunkDoc] = useState<DocItem | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
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

  async function uploadFiles(files: File[]) {
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

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    if (!canManage) return
    uploadFiles(Array.from(e.dataTransfer.files))
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/${renameTarget.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: renameValue.trim() }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "重命名失败"); return }
    toast.success("已重命名"); setRenameTarget(null); await fetchDocuments()
  }

  async function handleEmpty() {
    if (!emptyName.trim()) { toast.error("请填写文件名"); return }
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: emptyName.trim() }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "新建失败"); return }
    toast.success("已新建空文件"); setEmptyOpen(false); setEmptyName(""); await fetchDocuments()
  }

  async function handleReparse() {
    if (!reparseTarget || reparseTarget.length === 0) return
    const docIds = reparseTarget.map((d) => d.id)
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/reparse`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docIds, delete: reparseDelete, applyKb: reparseApplyKb }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "重新解析失败"); return }
    toast.success("已触发重新解析"); setReparseTarget(null); await fetchDocuments(); startPolling()
  }

  async function handleDownload(doc: DocItem) {
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/${doc.id}`)
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "下载失败"); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = doc.name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleToggleEnabled(doc: DocItem) {
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/${doc.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !(doc.enabled === 1) }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "操作失败"); return }
    await fetchDocuments()
  }

  async function handleStop(doc: DocItem) {
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/stop`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docIds: [doc.id] }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "停止失败"); return }
    toast.success("已停止解析"); await fetchDocuments()
  }

  async function handleDelete(docs: DocItem[]) {
    if (docs.length === 0) return
    if (!confirm(`确定删除 ${docs.length} 个文档？`)) return
    for (const doc of docs) {
      await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/${doc.id}`, { method: "DELETE" })
    }
    toast.success("已删除"); setSelected(new Set()); await fetchDocuments()
  }

  async function handleBatchStatus(enabled: boolean) {
    const ids = [...selected]
    if (ids.length === 0) return
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/batch-update-status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docIds: ids, enabled }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "操作失败"); return }
    toast.success(enabled ? "已启用" : "已禁用"); setSelected(new Set()); await fetchDocuments()
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const filtered = useMemo(() => {
    let list = documents
    if (search.trim()) list = list.filter((d) => d.name.toLowerCase().includes(search.trim().toLowerCase()))
    if (statusFilter !== "all") list = list.filter((d) => d.status === statusFilter)
    list = [...list].sort((a, b) => {
      const va = sortField === "name" ? a.name : (a.createTime ?? "")
      const vb = sortField === "name" ? b.name : (b.createTime ?? "")
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
    return list
  }, [documents, search, statusFilter, sortField, sortDir])

  const pageSize = 20
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  function toggleSort(field: "name" | "createTime") {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  if (fetching) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> 加载文档…</div>
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex items-center gap-2 p-2 rounded-md border border-dashed transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { uploadFiles(Array.from(e.target.files ?? [])); e.target.value = "" }} />
          <input ref={folderRef} type="file" multiple className="hidden" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => { uploadFiles(Array.from(e.target.files ?? [])); e.target.value = "" }} />
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {uploading ? "上传中…" : "上传文件"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => folderRef.current?.click()}><FolderUp className="h-4 w-4 mr-1" />上传文件夹</Button>
          <Button variant="outline" size="sm" onClick={() => setEmptyOpen(true)}><Plus className="h-4 w-4 mr-1" />新建空文件</Button>
          <span className="text-xs text-muted-foreground">或拖拽文件到此处</span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="搜索文件名…" className="max-w-60" />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="RUNNING">解析中</SelectItem>
            <SelectItem value="DONE">已完成</SelectItem>
            <SelectItem value="FAIL">解析失败</SelectItem>
            <SelectItem value="UNSTART">待解析</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={fetchDocuments}><RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} /></Button>
        {selected.size > 0 && canManage && (
          <div className="flex items-center gap-1.5 text-xs ml-auto">
            <span className="text-muted-foreground">已选 {selected.size} 项</span>
            <Button variant="outline" size="sm" onClick={() => handleBatchStatus(true)}>启用</Button>
            <Button variant="outline" size="sm" onClick={() => handleBatchStatus(false)}>禁用</Button>
            <Button variant="outline" size="sm" onClick={() => setReparseTarget(documents.filter((d) => selected.has(d.id)))}>重新解析</Button>
            <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(documents.filter((d) => selected.has(d.id)))}><Trash2 className="h-3.5 w-3.5 mr-1" />删除</Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6">暂无文档{canManage ? "，点击「上传文件」或拖拽添加" : ""}</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
            <span className="w-5" />
            <button onClick={() => toggleSort("name")} className="flex items-center gap-1 flex-1 min-w-0">文件名 <ArrowUpDown className="h-3 w-3" /></button>
            <button onClick={() => toggleSort("createTime")} className="flex items-center gap-1 w-24">日期 <ArrowUpDown className="h-3 w-3" /></button>
            <span className="w-16 text-center">启用</span>
            <span className="w-24 text-center">解析状态</span>
            {canManage && <span className="w-20" />}
          </div>
          {paged.map((doc) => (
            <div key={doc.id} className={`flex items-center gap-2 rounded-md border border-border p-2.5 ${doc.enabled === 0 ? "opacity-60" : ""}`}>
              <Checkbox checked={selected.has(doc.id)} onCheckedChange={() => toggleSelect(doc.id)} />
              <button className="flex-1 min-w-0 text-left" onClick={() => setChunkDoc(doc)}>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate hover:underline">{doc.name}</span>
                </div>
              </button>
              <span className="w-24 text-xs text-muted-foreground">{fmtTime(doc.createTime)}</span>
              <span className="w-16 flex justify-center">
                {canManage && (
                  <button
                    onClick={() => handleToggleEnabled(doc)}
                    className={`h-5 px-1.5 rounded text-[10px] ${doc.enabled === 1 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {doc.enabled === 1 ? "启用" : "禁用"}
                  </button>
                )}
              </span>
              <div className="w-24 flex flex-col items-center gap-0.5">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE[doc.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[doc.status] ?? doc.status}
                </span>
                {(doc.status === "RUNNING" || doc.status === "UNSTART") && (
                  <Progress value={Math.round(doc.progress * 100)} className="h-1 w-full" />
                )}
              </div>
              {canManage && (
                <div className="w-20 flex items-center justify-end gap-0.5">
                  {(doc.status === "RUNNING" || doc.status === "UNSTART") && (
                    <button onClick={() => handleStop(doc)} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="停止解析"><CircleStop className="h-3.5 w-3.5" /></button>
                  )}
                  {doc.status === "DONE" && (
                    <button onClick={() => setReparseTarget([doc])} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="重新解析"><RefreshCw className="h-3.5 w-3.5" /></button>
                  )}
                  <button onClick={() => { setRenameTarget(doc); setRenameValue(doc.name) }} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="重命名"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDownload(doc)} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground" title="下载"><Download className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete([doc])} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600" title="删除"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}

      {/* 重命名 Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(v) => { if (!v) setRenameTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>重命名文档</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={255} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRenameTarget(null)}>取消</Button>
            <Button onClick={handleRename}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 新建空文件 Dialog */}
      <Dialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>新建空文件</DialogTitle></DialogHeader>
          <Input value={emptyName} onChange={(e) => setEmptyName(e.target.value)} placeholder="文件名（含后缀，如 notes.md）" maxLength={255} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEmptyOpen(false)}>取消</Button>
            <Button onClick={handleEmpty}>新建</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 重新解析 Dialog */}
      <Dialog open={!!reparseTarget} onOpenChange={(v) => { if (!v) setReparseTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>重新解析</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={reparseDelete} onCheckedChange={(v) => setReparseDelete(!!v)} />
              删除已有分块再重新解析
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={reparseApplyKb} onCheckedChange={(v) => setReparseApplyKb(!!v)} />
              应用知识库自动元数据设置
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setReparseTarget(null)}>取消</Button>
            <Button onClick={handleReparse}>开始解析</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* chunk 详情 */}
      <ChunkViewer
        datasetId={datasetId}
        documentId={chunkDoc?.id ?? ""}
        documentName={chunkDoc?.name ?? ""}
        open={!!chunkDoc}
        onOpenChange={(v) => { if (!v) setChunkDoc(null) }}
      />
    </div>
  )
}
