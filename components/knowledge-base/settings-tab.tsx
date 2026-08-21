"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { useUser } from "@/lib/hooks/use-user"

const CHUNK_METHODS: { value: string; label: string }[] = [
  { value: "naive", label: "通用（按段落）" },
  { value: "table", label: "表格" },
  { value: "qa", label: "问答" },
  { value: "manual", label: "手册" },
  { value: "paper", label: "论文" },
  { value: "book", label: "书籍" },
  { value: "laws", label: "法律" },
  { value: "presentation", label: "演示文稿" },
  { value: "picture", label: "图片" },
  { value: "email", label: "邮件" },
  { value: "resume", label: "简历" },
  { value: "tag", label: "标签" },
  { value: "one", label: "单段" },
]

const LAYOUT_OPTIONS = [
  { value: "DeepDOC", label: "DeepDOC（版面分析，识别标题/表格/图片）" },
  { value: "Naive", label: "Naive（仅纯文本）" },
]

type Dataset = {
  id: string; name: string; description?: string
  chunkMethod?: string; embeddingModel?: string; parserConfig?: Record<string, unknown>
}

export function SettingsTab({ datasetId }: { datasetId: string }) {
  const { user } = useUser()
  const canManage = !!user?.permissions?.includes("manage_knowledge")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [chunkMethod, setChunkMethod] = useState("naive")
  const [chunkTokenNum, setChunkTokenNum] = useState(512)
  const [delimiter, setDelimiter] = useState("\\n")
  const [layoutRecognize, setLayoutRecognize] = useState("DeepDOC")
  const [embeddingModel, setEmbeddingModel] = useState("")

  const fetchDataset = useCallback(async () => {
    try {
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}`)
      if (!res.ok) return
      const d = await res.json()
      const ds = d.dataset as Dataset
      setName(ds.name ?? "")
      setDescription(ds.description ?? "")
      setChunkMethod(ds.chunkMethod ?? "naive")
      setEmbeddingModel(ds.embeddingModel ?? "")
      const pc = (ds.parserConfig ?? {}) as Record<string, unknown>
      setChunkTokenNum(typeof pc.chunk_token_num === "number" ? pc.chunk_token_num : 512)
      setDelimiter(typeof pc.delimiter === "string" ? pc.delimiter : "\\n")
      setLayoutRecognize(typeof pc.layout_recognize === "string" ? pc.layout_recognize : "DeepDOC")
    } finally { setLoading(false) }
  }, [datasetId])

  useEffect(() => { fetchDataset() }, [fetchDataset])

  async function handleSave() {
    if (!name.trim()) { toast.error("请填写知识库名称"); return }
    setSaving(true)
    try {
      // 合并现有 parser_config（保留未在表单展示的字段），仅覆盖三个展示项
      const parserConfig = {
        chunk_token_num: chunkTokenNum,
        delimiter: delimiter.replace(/^\\n$/, "\n"),
        layout_recognize: layoutRecognize,
      }
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), chunkMethod, parserConfig }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "保存失败"); return }
      toast.success("配置已保存")
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> 加载配置…</div>
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">知识库名称</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} maxLength={128} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">描述</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canManage} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">切片方法（chunk_method）</label>
            <Select value={chunkMethod} onValueChange={setChunkMethod} disabled={!canManage}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHUNK_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">决定文档如何切分成检索片段，按文档类型选择（表格文档选「表格」，政策文件选「通用」）。</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">分块大小（Token）</label>
              <Input type="number" min={1} max={2048} value={chunkTokenNum} onChange={(e) => setChunkTokenNum(Number(e.target.value) || 512)} disabled={!canManage} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">分隔符</label>
              <Input value={delimiter} onChange={(e) => setDelimiter(e.target.value)} disabled={!canManage} placeholder="\n" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">PDF 布局识别</label>
            <Select value={layoutRecognize} onValueChange={setLayoutRecognize} disabled={!canManage}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LAYOUT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">DeepDOC 能识别 PDF 标题/表格/图片位置（红头文件、扫描件建议用），Naive 仅取纯文本。</p>
          </div>

          {embeddingModel && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Embedding 模型：</span>
              <span className="font-medium text-foreground">{embeddingModel}</span>
              <span className="text-[10px]">（只读，需在 RAGFlow 端切换）</span>
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {saving ? "保存中…" : "保存配置"}
        </Button>
      )}
    </div>
  )
}
