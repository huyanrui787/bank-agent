"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Play, Pencil, Trash2, GitBranch, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PRESET_WORKFLOWS } from "@/lib/workflow/presets"

type WFItem = { id: string; name: string; description: string; enabled: boolean; createdAt: string }

export default function WorkflowListPage() {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<WFItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows")
      if (res.ok) setWorkflows((await res.json()).workflows ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  async function createFromPreset(idx: number) {
    const res = await fetch("/api/workflows", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset: idx }),
    })
    if (!res.ok) { toast.error("创建失败"); return }
    const { id } = await res.json()
    toast.success("已从模板创建")
    router.push(`/workflow/${id}`)
  }

  async function createEmpty() {
    const res = await fetch("/api/workflows", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "新工作流", description: "",
        definition: {
          nodes: [
            { id: "start", type: "start", position: { x: 100, y: 200 }, data: { label: "开始" } },
            { id: "end",   type: "end",   position: { x: 500, y: 200 }, data: { label: "结束" } },
          ],
          edges: [{ id: "e1", source: "start", target: "end" }],
        },
      }),
    })
    if (!res.ok) { toast.error("创建失败"); return }
    const { id } = await res.json()
    router.push(`/workflow/${id}`)
  }

  async function handleDelete(wf: WFItem) {
    if (!confirm(`确定删除「${wf.name}」？`)) return
    await fetch(`/api/workflows/${wf.id}`, { method: "DELETE" })
    toast.success("已删除")
    fetch_()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" /> Agent 编排工作流
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">可视化拖拽连接节点，构建多步 AI 分析流程。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetch_} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={createEmpty}>
            <Plus className="h-4 w-4 mr-1" /> 新建工作流
          </Button>
        </div>
      </div>

      {/* Presets */}
      <div>
        <p className="text-sm font-medium mb-3">预置模板</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PRESET_WORKFLOWS.map((p, i) => (
            <Card key={i} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => createFromPreset(i)}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <GitBranch className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{p.name}</span>
                    <Badge variant="info" className="text-[10px]">模板</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.definition.nodes.length} 个节点 · {p.definition.edges.length} 条连线
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-xs">使用模板</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* User workflows */}
      {workflows.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-3">我的工作流</p>
          <div className="space-y-2">
            {workflows.map((wf) => (
              <Card key={wf.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{wf.name}</span>
                      {wf.enabled
                        ? <Badge variant="success" className="text-[10px]">已启用</Badge>
                        : <Badge variant="muted" className="text-[10px]">已停用</Badge>}
                    </div>
                    {wf.description && <p className="text-xs text-muted-foreground mt-0.5">{wf.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/workflow/${wf.id}`)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> 编辑
                    </Button>
                    <Button size="sm" onClick={() => router.push(`/workflow/${wf.id}?run=1`)}>
                      <Play className="h-3.5 w-3.5 mr-1" /> 运行
                    </Button>
                    <button onClick={() => handleDelete(wf)}
                      className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {workflows.length === 0 && !loading && (
        <div className="text-center text-sm text-muted-foreground py-6">
          还没有工作流，从模板开始或新建一个
        </div>
      )}
    </div>
  )
}
