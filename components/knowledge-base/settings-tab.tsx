"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
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
  { value: "DeepDOC", label: "DeepDOC（版面分析）" },
  { value: "Naive", label: "Naive（仅纯文本）" },
]
const LANGUAGES = [
  { value: "Chinese", label: "中文" },
  { value: "English", label: "English" },
]

type Dataset = {
  id: string; name: string; description?: string
  chunkMethod?: string; embeddingModel?: string; parserConfig?: Record<string, unknown>
  language?: string; permission?: string
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
  const [autoKeywords, setAutoKeywords] = useState(0)
  const [autoQuestions, setAutoQuestions] = useState(0)
  const [html4excel, setHtml4excel] = useState(false)
  const [enableChildren, setEnableChildren] = useState(false)
  const [childrenDelimiter, setChildrenDelimiter] = useState("")
  const [overlappedPercent, setOverlappedPercent] = useState(0)
  const [language, setLanguage] = useState("Chinese")
  const [permission, setPermission] = useState("me")
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
      setLanguage(ds.language ?? "Chinese")
      setPermission(ds.permission ?? "me")
      const pc = (ds.parserConfig ?? {}) as Record<string, unknown>
      setChunkTokenNum(typeof pc.chunk_token_num === "number" ? pc.chunk_token_num : 512)
      setDelimiter(typeof pc.delimiter === "string" ? pc.delimiter : "\\n")
      setLayoutRecognize(typeof pc.layout_recognize === "string" ? pc.layout_recognize : "DeepDOC")
      setAutoKeywords(typeof pc.auto_keywords === "number" ? pc.auto_keywords : 0)
      setAutoQuestions(typeof pc.auto_questions === "number" ? pc.auto_questions : 0)
      setHtml4excel(!!pc.html4excel)
      setEnableChildren(!!pc.enable_children)
      setChildrenDelimiter(typeof pc.children_delimiter === "string" ? pc.children_delimiter : "")
      setOverlappedPercent(typeof pc.overlapped_percent === "number" ? pc.overlapped_percent : 0)
    } finally { setLoading(false) }
  }, [datasetId])

  useEffect(() => { fetchDataset() }, [fetchDataset])

  async function handleSave() {
    if (!name.trim()) { toast.error("请填写知识库名称"); return }
    setSaving(true)
    try {
      const parserConfig: Record<string, unknown> = {
        chunk_token_num: chunkTokenNum,
        delimiter: delimiter.replace(/^\\n$/, "\n"),
        layout_recognize: layoutRecognize,
        auto_keywords: autoKeywords,
        auto_questions: autoQuestions,
        html4excel,
        enable_children: enableChildren,
        children_delimiter: enableChildren ? childrenDelimiter : "",
        overlapped_percent: overlappedPercent,
      }
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), chunkMethod, parserConfig, language, permission }),
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">知识库名称</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} maxLength={128} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">语言</label>
              <Select value={language} onValueChange={setLanguage} disabled={!canManage}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">描述</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canManage} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">切片方法</label>
              <Select value={chunkMethod} onValueChange={setChunkMethod} disabled={!canManage}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHUNK_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">权限</label>
              <Select value={permission} onValueChange={setPermission} disabled={!canManage}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">仅自己</SelectItem>
                  <SelectItem value="team">团队</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                {LAYOUT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">自动关键词（每块 N 个）</label>
                <span className="text-xs">{autoKeywords}</span>
              </div>
              <input type="range" min={0} max={32} value={autoKeywords} onChange={(e) => setAutoKeywords(Number(e.target.value))} disabled={!canManage} className="w-full" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">自动问题（每块 N 个）</label>
                <span className="text-xs">{autoQuestions}</span>
              </div>
              <input type="range" min={0} max={10} value={autoQuestions} onChange={(e) => setAutoQuestions(Number(e.target.value))} disabled={!canManage} className="w-full" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">相邻分块重叠度</label>
              <span className="text-xs">{overlappedPercent.toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={0.3} step={0.01} value={overlappedPercent} onChange={(e) => setOverlappedPercent(Number(e.target.value))} disabled={!canManage} className="w-full" />
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={html4excel} onCheckedChange={(v) => setHtml4excel(!!v)} disabled={!canManage} />
              表格转 HTML（提升 Excel/表格文档解析）
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={enableChildren} onCheckedChange={(v) => setEnableChildren(!!v)} disabled={!canManage} />
              启用父级分块（parent-child）
            </label>
            {enableChildren && (
              <div className="pl-6 space-y-1.5">
                <label className="text-xs text-muted-foreground">子分隔符</label>
                <Input value={childrenDelimiter} onChange={(e) => setChildrenDelimiter(e.target.value)} disabled={!canManage} placeholder="如：\n" />
              </div>
            )}
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
