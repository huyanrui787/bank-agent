"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Trash2, RefreshCw, BookOpen, Upload, FileText, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { useUser } from "@/lib/hooks/use-user"

type Dataset = { id: string; name: string; description?: string; documentCount?: number; chunkCount?: number }
type DocItem = { id: string; name: string; status: string; progress: number; chunkCount?: number; size?: string }

const STATUS_LABELS: Record<string, string> = {
  UNSTART: "待解析", RUNNING: "解析中", DONE: "已完成", FAIL: "解析失败", CANCEL: "已取消",
}
const STATUS_BADGE: Record<string, string> = {
  UNSTART: "bg-gray-100 text-gray-600", RUNNING: "bg-blue-50 text-blue-700",
  DONE: "bg-green-50 text-green-700", FAIL: "bg-red-50 text-red-700", CANCEL: "bg-gray-100 text-gray-500",
}

function DatasetForm({ open, onOpenChange, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)

  if (open && !wasOpen) {
    setWasOpen(true)
    setName(""); setDescription("")
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("请填写知识库名称"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/knowledge-base/datasets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "创建失败"); return }
      toast.success("知识库已创建")
      onOpenChange(false)
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader><SheetTitle>新建知识库</SheetTitle></SheetHeader>
        <div className="flex-1 px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">知识库名称 <span className="text-red-500">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：信贷政策库" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">描述（可选）</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="如：行内贷款政策与合规文件" maxLength={500} />
          </div>
          <p className="text-xs text-muted-foreground">
            文档上传、解析、分块与向量化由 RAGFlow 引擎完成，解析完成后即可在工作台检索该知识库内容。
          </p>
        </div>
        <SheetFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "创建中…" : "创建"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default function KnowledgeBasePage() {
  const { user, loading } = useUser()
  const canManage = !!user?.permissions?.includes("manage_knowledge")
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [docsFetching, setDocsFetching] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge-base/datasets")
      if (res.status >= 500) { setUnavailable(true); setDatasets([]); return }
      const d = await res.json()
      setUnavailable(false)
      setDatasets(d.datasets ?? [])
    } finally { setFetching(false) }
  }, [])

  const fetchDocuments = useCallback(async (id: string) => {
    setDocsFetching(true)
    try {
      const res = await fetch(`/api/knowledge-base/datasets/${id}/documents`)
      if (!res.ok) return []
      const d = await res.json()
      const docs = (d.documents ?? []) as DocItem[]
      setDocuments(docs)
      return docs
    } finally { setDocsFetching(false) }
  }, [])

  useEffect(() => { fetchDatasets() }, [fetchDatasets])
  useEffect(() => stopPolling, [stopPolling])

  function startPolling(id: string) {
    stopPolling()
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/knowledge-base/datasets/${id}/documents`).catch(() => null)
      if (!res || !res.ok) return
      const d = await res.json().catch(() => null)
      const docs = (d?.documents ?? []) as DocItem[]
      setDocuments(docs)
      const busy = docs.some((x) => x.status === "RUNNING" || x.status === "UNSTART")
      if (!busy) stopPolling()
    }, 2000)
  }

  async function handleSelect(id: string) {
    setSelectedId(id)
    setDocuments([])
    const docs = await fetchDocuments(id)
    const busy = (docs ?? []).some((x) => x.status === "RUNNING" || x.status === "UNSTART")
    if (busy) startPolling(id)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !selectedId) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/knowledge-base/datasets/${selectedId}/documents`, { method: "POST", body: fd })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "上传失败"); return }
      toast.success("已上传，开始解析…")
      await fetchDocuments(selectedId)
      startPolling(selectedId)
    } finally { setUploading(false) }
  }

  async function handleDeleteDataset(ds: Dataset) {
    if (!confirm(`确定删除知识库「${ds.name}」？其中文档将一并删除。`)) return
    const res = await fetch(`/api/knowledge-base/datasets/${ds.id}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "删除失败"); return }
    toast.success("已删除")
    if (selectedId === ds.id) { setSelectedId(null); setDocuments([]) }
    await fetchDatasets()
  }

  async function handleDeleteDoc(doc: DocItem) {
    if (!selectedId) return
    if (!confirm(`确定删除文档「${doc.name}」？`)) return
    const res = await fetch(`/api/knowledge-base/datasets/${selectedId}/documents/${doc.id}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "删除失败"); return }
    toast.success("已删除")
    await fetchDocuments(selectedId)
    await fetchDatasets()
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>
  if (!user) return null

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">知识库</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            上传政策、合规、贷前调查等文档，RAGFlow 引擎负责解析与向量化，AI 工作台可检索并标注来源。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDatasets} disabled={fetching}>
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> 新建知识库
            </Button>
          )}
        </div>
      </div>

      {unavailable && (
        <div className="flex items-center gap-2 p-3 rounded-md text-sm bg-amber-50 text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>知识库服务未接入：RAGFlow 未配置或不可达，请检查 RAGFLOW_BASE_URL / RAGFLOW_API_KEY。</span>
        </div>
      )}

      {!unavailable && datasets.length === 0 && !fetching && (
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-3 text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-30" />
            <p className="text-sm">还没有知识库</p>
            {canManage ? (
              <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> 创建第一个知识库
              </Button>
            ) : (
              <p className="text-xs">请联系管理员创建知识库</p>
            )}
          </CardContent>
        </Card>
      )}

      {datasets.length > 0 && (
        <div className="space-y-2">
          {datasets.map((ds) => (
            <Card key={ds.id} className={selectedId === ds.id ? "ring-1 ring-primary" : ""}>
              <CardContent className="p-4">
                <button className="w-full text-left" onClick={() => handleSelect(ds.id)}>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{ds.name}</span>
                        {typeof ds.documentCount === "number" && (
                          <span className="text-xs text-muted-foreground">{ds.documentCount} 篇文档</span>
                        )}
                        {typeof ds.chunkCount === "number" && (
                          <span className="text-xs text-muted-foreground">{ds.chunkCount} 分块</span>
                        )}
                      </div>
                      {ds.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{ds.description}</p>}
                    </div>
                    {canManage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteDataset(ds) }}
                        className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </button>

                {selectedId === ds.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    {canManage && (
                      <div className="flex items-center gap-2 mb-3">
                        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
                        <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          {uploading ? "上传中…" : "上传文档"}
                        </Button>
                        <span className="text-xs text-muted-foreground">支持 PDF / Word / TXT / Markdown 等，上传后自动解析</span>
                      </div>
                    )}

                    {docsFetching && documents.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                        <Loader2 className="h-4 w-4 animate-spin" /> 加载文档…
                      </div>
                    ) : documents.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4">暂无文档{canManage ? "，点击「上传文档」添加" : ""}</p>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-3 rounded-md border border-border p-2.5">
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
                              </div>
                              {(doc.status === "RUNNING" || doc.status === "UNSTART") && (
                                <div className="mt-1.5 flex items-center gap-2">
                                  <Progress value={Math.round(doc.progress * 100)} className="flex-1" />
                                  <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(doc.progress * 100)}%</span>
                                </div>
                              )}
                            </div>
                            {canManage && (
                              <button
                                onClick={() => handleDeleteDoc(doc)}
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
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DatasetForm open={formOpen} onOpenChange={setFormOpen} onSaved={fetchDatasets} />
    </div>
  )
}
