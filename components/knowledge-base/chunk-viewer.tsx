"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, RefreshCw, Loader2, Power } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { useUser } from "@/lib/hooks/use-user"

type ChunkItem = { id: string; content: string; available: boolean }

export function ChunkViewer({ datasetId, documentId, documentName, open, onOpenChange }: {
  datasetId: string
  documentId: string
  documentName: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { user } = useUser()
  const canManage = !!user?.permissions?.includes("manage_knowledge")
  const [chunks, setChunks] = useState<ChunkItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newContent, setNewContent] = useState("")
  const pageSize = 20

  const fetchChunks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/${documentId}/chunks?page=${page}&page_size=${pageSize}`)
      if (!res.ok) return
      const d = await res.json()
      setChunks(d.chunks ?? [])
      setTotal(d.total ?? 0)
      setSelected(new Set())
    } finally { setLoading(false) }
  }, [datasetId, documentId, page])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 打开 Drawer 时拉取 chunk，属外部数据同步 */
    if (open) fetchChunks()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, fetchChunks])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (!newContent.trim()) { toast.error("请输入 chunk 内容"); return }
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/${documentId}/chunks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newContent.trim() }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "新建失败"); return }
    toast.success("已新建 chunk")
    setNewContent("")
    await fetchChunks()
  }

  async function handleDelete() {
    const ids = [...selected]
    if (ids.length === 0) { toast.error("请先勾选 chunk"); return }
    if (!confirm(`确定删除 ${ids.length} 个 chunk？`)) return
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/${documentId}/chunks`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunkIds: ids }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "删除失败"); return }
    toast.success("已删除")
    await fetchChunks()
  }

  async function handleSwitch(ids: string[], available: boolean) {
    const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/documents/${documentId}/chunks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunkIds: ids, available }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "操作失败"); return }
    toast.success(available ? "已启用" : "已禁用")
    await fetchChunks()
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="truncate pr-6">分块详情 · {documentName}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {canManage && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="新建 chunk 内容…"
                  className="flex-1"
                />
                <Button size="sm" onClick={handleCreate}><Plus className="h-4 w-4 mr-1" />新建</Button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {selected.size > 0 && (
                  <>
                    <span className="text-muted-foreground">已选 {selected.size} 项</span>
                    <Button variant="outline" size="sm" onClick={() => handleSwitch([...selected], true)}>启用</Button>
                    <Button variant="outline" size="sm" onClick={() => handleSwitch([...selected], false)}>禁用</Button>
                    <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600"><Trash2 className="h-3.5 w-3.5 mr-1" />删除</Button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>共 {total} 个 chunk</span>
            <Button variant="ghost" size="sm" onClick={fetchChunks} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
          </div>

          {loading && chunks.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> 加载 chunk…</div>
          ) : chunks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6">暂无 chunk</p>
          ) : (
            <div className="space-y-2">
              {chunks.map((c) => (
                <div key={c.id} className={`rounded-md border p-2.5 ${c.available ? "border-border" : "border-border opacity-60"}`}>
                  <div className="flex items-start gap-2">
                    {canManage && (
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} className="mt-0.5" />
                    )}
                    <p className="flex-1 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-6">{c.content}</p>
                    {canManage && (
                      <button
                        onClick={() => handleSwitch([c.id], !c.available)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground shrink-0"
                        title={c.available ? "禁用" : "启用"}
                      >
                        <Power className={`h-3.5 w-3.5 ${c.available ? "text-green-600" : ""}`} />
                      </button>
                    )}
                  </div>
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
        </div>
      </SheetContent>
    </Sheet>
  )
}
