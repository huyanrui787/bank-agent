"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, Save, Settings2, BookOpen } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useUser } from "@/lib/hooks/use-user"
import { MetadataDialog } from "./metadata-dialog"

const CHUNK_METHODS: { value: string; label: string; desc: string }[] = [
  { value: "naive", label: "通用（按段落）", desc: "按段落与分隔符切分，适合大多数政策、制度、报告类文档。" },
  { value: "table", label: "表格", desc: "按表格结构切分，适合 Excel、含大量表格的文档。" },
  { value: "qa", label: "问答", desc: "按问答对切分，适合 FAQ、制度问答类文档。" },
  { value: "manual", label: "手册", desc: "按标题层级切分，适合操作手册、指南类文档。" },
  { value: "paper", label: "论文", desc: "按章节切分，适合研究报告、论文类文档。" },
  { value: "book", label: "书籍", desc: "按书籍章节切分，适合成册的图书、汇编。" },
  { value: "laws", label: "法律", desc: "按条款切分，适合法规、合同、红头文件。" },
  { value: "presentation", label: "演示文稿", desc: "按幻灯片切分，适合 PPT 类文档。" },
  { value: "tag", label: "标签", desc: "按标签切分，适合已打标签的结构化内容。" },
  { value: "one", label: "单段", desc: "整篇文档作为一个分块，适合短文档。" },
]
const LAYOUT_OPTIONS: { value: string; label: string }[] = [
  { value: "DeepDOC", label: "DeepDOC（版面分析）" },
  { value: "Plain Text", label: "Plain Text（纯文本）" },
  { value: "Docling", label: "Docling" },
  { value: "OpenDataLoader", label: "OpenDataLoader" },
  { value: "TCADP Parser", label: "TCADP Parser" },
]
const LANGUAGES = [
  { value: "Chinese", label: "中文" },
  { value: "English", label: "English" },
  { value: "Traditional Chinese", label: "繁體中文" },
  { value: "Japanese", label: "日本語" },
  { value: "Korean", label: "한국어" },
  { value: "Spanish", label: "Español" },
  { value: "French", label: "Français" },
  { value: "German", label: "Deutsch" },
  { value: "Russian", label: "Русский" },
  { value: "Vietnamese", label: "Tiếng Việt" },
  { value: "Portuguese BR", label: "Português" },
  { value: "Italian", label: "Italiano" },
]

type Dataset = {
  id: string; name: string; description?: string
  chunkMethod?: string; embeddingModel?: string; parserConfig?: Record<string, unknown>
  language?: string; permission?: string; pagerank?: number; chunkCount?: number; avatar?: string
}
type Model = { modelId: string; name: string; providerName?: string; instanceName?: string }
type Pipeline = { id: string; title: string; description?: string }
type TagDs = { id: string; name: string }

function escapeDelimiter(s: string) {
  return s.replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\r/g, "\\r")
}
function unescapeDelimiter(s: string) {
  return s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r")
}

export function SettingsTab({ datasetId }: { datasetId: string }) {
  const { user } = useUser()
  const canManage = !!user?.permissions?.includes("manage_knowledge")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 基础信息
  const [name, setName] = useState("")
  const [language, setLanguage] = useState("Chinese")
  const [description, setDescription] = useState("")
  const [permission, setPermission] = useState("me")
  const [pagerank, setPagerank] = useState(0)
  const [embeddingModel, setEmbeddingModel] = useState("")
  const [chunkCount, setChunkCount] = useState(0)
  const [models, setModels] = useState<Model[]>([])
  const [avatar, setAvatar] = useState("")
  const avatarRef = useRef<HTMLInputElement>(null)

  // 数据管道
  const [parseType, setParseType] = useState<"builtin" | "pipeline">("builtin")
  const [chunkMethod, setChunkMethod] = useState("naive")
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [pipelineId, setPipelineId] = useState("")
  const [tagDatasets, setTagDatasets] = useState<TagDs[]>([])
  const [tagKbIds, setTagKbIds] = useState<string[]>([])
  const [topnTags, setTopnTags] = useState(3)

  // 解析配置
  const [layoutRecognize, setLayoutRecognize] = useState("DeepDOC")
  const [chunkTokenNum, setChunkTokenNum] = useState(512)
  const [delimiter, setDelimiter] = useState("\\n")
  const [enableChildren, setEnableChildren] = useState(false)
  const [childrenDelimiter, setChildrenDelimiter] = useState("")
  const [imageTableContextWindow, setImageTableContextWindow] = useState(0)
  const [autoKeywords, setAutoKeywords] = useState(0)
  const [autoQuestions, setAutoQuestions] = useState(0)
  const [html4excel, setHtml4excel] = useState(false)
  const [overlappedPercent, setOverlappedPercent] = useState(0)
  const [enableMetadata, setEnableMetadata] = useState(false)

  const [metadataOpen, setMetadataOpen] = useState(false)

  const fetchDataset = useCallback(async () => {
    try {
      const [dsRes, modelsRes, pipelinesRes, datasetsRes] = await Promise.all([
        fetch(`/api/knowledge-base/datasets/${datasetId}`),
        fetch("/api/knowledge-base/models"),
        fetch("/api/knowledge-base/pipelines"),
        fetch("/api/knowledge-base/datasets"),
      ])
      if (dsRes.ok) {
        const d = await dsRes.json()
        const ds = d.dataset as Dataset
        setName(ds.name ?? "")
        setLanguage(ds.language ?? "Chinese")
        setDescription(ds.description ?? "")
        setPermission(ds.permission ?? "me")
        setPagerank(typeof ds.pagerank === "number" ? ds.pagerank : 0)
        setEmbeddingModel(ds.embeddingModel ?? "")
        setChunkCount(typeof ds.chunkCount === "number" ? ds.chunkCount : 0)
        setAvatar(ds.avatar ?? "")
        setChunkMethod(ds.chunkMethod ?? "naive")
        setPipelineId((ds.parserConfig as Record<string, unknown>)?.pipeline_id ? String((ds.parserConfig as Record<string, unknown>).pipeline_id) : "")
        const pc = (ds.parserConfig ?? {}) as Record<string, unknown>
        setLayoutRecognize(typeof pc.layout_recognize === "string" ? pc.layout_recognize : "DeepDOC")
        setChunkTokenNum(typeof pc.chunk_token_num === "number" ? pc.chunk_token_num : 512)
        setDelimiter(escapeDelimiter(typeof pc.delimiter === "string" ? pc.delimiter : "\n"))
        setEnableChildren(!!pc.enable_children)
        setChildrenDelimiter(typeof pc.children_delimiter === "string" ? pc.children_delimiter : "")
        setImageTableContextWindow(typeof pc.image_table_context_window === "number" ? pc.image_table_context_window : 0)
        setAutoKeywords(typeof pc.auto_keywords === "number" ? pc.auto_keywords : 0)
        setAutoQuestions(typeof pc.auto_questions === "number" ? pc.auto_questions : 0)
        setHtml4excel(!!pc.html4excel)
        setOverlappedPercent(typeof pc.overlapped_percent === "number" ? pc.overlapped_percent : 0)
        setEnableMetadata(!!pc.enable_metadata)
        setTagKbIds(Array.isArray(pc.tag_kb_ids) ? (pc.tag_kb_ids as string[]) : [])
        setTopnTags(typeof pc.topn_tags === "number" ? pc.topn_tags : 3)
      }
      if (modelsRes.ok) { const d = await modelsRes.json(); setModels(d.models ?? []) }
      if (pipelinesRes.ok) { const d = await pipelinesRes.json(); setPipelines(d.pipelines ?? []) }
      if (datasetsRes.ok) {
        const d = await datasetsRes.json()
        setTagDatasets((d.datasets ?? []).filter((x: Dataset) => x.chunkMethod === "tag").map((x: Dataset) => ({ id: x.id, name: x.name })))
      }
    } finally { setLoading(false) }
  }, [datasetId])

  useEffect(() => { fetchDataset() }, [fetchDataset])

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > 2_000_000) { toast.error("图片过大，请选择 2MB 以内的图片"); return }
    const reader = new FileReader()
    reader.onload = () => setAvatar(String(reader.result ?? ""))
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("请填写知识库名称"); return }
    setSaving(true)
    try {
      const parserConfig: Record<string, unknown> = {
        layout_recognize: layoutRecognize,
        chunk_token_num: chunkTokenNum,
        delimiter: unescapeDelimiter(delimiter),
        enable_children: enableChildren,
        children_delimiter: enableChildren ? unescapeDelimiter(childrenDelimiter) : "",
        image_table_context_window: imageTableContextWindow,
        auto_keywords: autoKeywords,
        auto_questions: autoQuestions,
        html4excel,
        overlapped_percent: overlappedPercent,
        enable_metadata: enableMetadata,
        tag_kb_ids: tagKbIds,
        topn_tags: topnTags,
      }
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), description: description.trim(), language, permission, pagerank,
          embeddingModel, parserConfig,
          chunkMethod: parseType === "builtin" ? chunkMethod : undefined,
          pipelineId: parseType === "pipeline" ? pipelineId : null,
          avatar,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "保存失败"); return }
      toast.success("配置已保存")
    } finally { setSaving(false) }
  }

  const currentChunkMethod = CHUNK_METHODS.find((m) => m.value === chunkMethod)

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> 加载配置…</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
      {/* 左栏：表单 */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-base font-medium mb-4">基础信息</div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">知识库名称 <span className="text-red-500">*</span></label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} maxLength={128} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">头像</label>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="头像" className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={!canManage} />
                  <Button variant="outline" size="sm" onClick={() => avatarRef.current?.click()} disabled={!canManage}>上传</Button>
                  {avatar && <Button variant="ghost" size="sm" onClick={() => setAvatar("")} disabled={!canManage}>移除</Button>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">语言</label>
                  <Select value={language} onValueChange={setLanguage} disabled={!canManage}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium">描述</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canManage} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Embedding 模型{chunkCount > 0 && <span className="text-xs text-muted-foreground">（有文档时不可切换）</span>}</label>
                <Select value={embeddingModel} onValueChange={setEmbeddingModel} disabled={!canManage || chunkCount > 0}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="选择 embedding 模型" /></SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.modelId} value={m.modelId}>
                        {m.name}{m.providerName ? `（${m.providerName}）` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">PageRank 权重</label>
                  <span className="text-xs">{pagerank}</span>
                </div>
                <input type="range" min={0} max={100} value={pagerank} onChange={(e) => setPagerank(Number(e.target.value))} disabled={!canManage} className="w-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-base font-medium mb-4">数据管道</div>
            <div className="space-y-4">
              <div className="flex rounded-md border border-border overflow-hidden w-fit">
                <button
                  onClick={() => setParseType("builtin")}
                  className={`px-3 py-1.5 text-xs ${parseType === "builtin" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >内置切片</button>
                <button
                  onClick={() => setParseType("pipeline")}
                  className={`px-3 py-1.5 text-xs ${parseType === "pipeline" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >数据管线</button>
              </div>

              {parseType === "builtin" ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">切片方法</label>
                  <Select value={chunkMethod} onValueChange={setChunkMethod} disabled={!canManage}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHUNK_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">数据管线</label>
                  <Select value={pipelineId} onValueChange={setPipelineId} disabled={!canManage}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="选择管线" /></SelectTrigger>
                    <SelectContent>
                      {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              {parseType === "builtin" && (
                <>
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
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">分块大小（Token）</label>
                      <Input type="number" min={1} max={2048} value={chunkTokenNum} onChange={(e) => setChunkTokenNum(Number(e.target.value) || 512)} disabled={!canManage} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">分隔符</label>
                      <Input value={delimiter} onChange={(e) => setDelimiter(e.target.value)} disabled={!canManage} placeholder="\n（支持 \n \t \r）" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">自动关键词（每块 N 个）</label>
                        <span className="text-xs">{autoKeywords}</span>
                      </div>
                      <input type="range" min={0} max={30} value={autoKeywords} onChange={(e) => setAutoKeywords(Number(e.target.value))} disabled={!canManage} className="w-full" />
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

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">图片/表格上下文窗口</label>
                      <span className="text-xs">{imageTableContextWindow}</span>
                    </div>
                    <input type="range" min={0} max={256} value={imageTableContextWindow} onChange={(e) => setImageTableContextWindow(Number(e.target.value))} disabled={!canManage} className="w-full" />
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
                </>
              )}

              {/* 标签知识库 */}
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">标签知识库</label>
                {tagDatasets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">没有可用的标签类型知识库</p>
                ) : (
                  <div className="space-y-1.5">
                    {tagDatasets.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={tagKbIds.includes(t.id)}
                          onCheckedChange={(v) => setTagKbIds((p) => v ? [...p, t.id] : p.filter((x) => x !== t.id))}
                          disabled={!canManage}
                        />
                        {t.name}
                      </label>
                    ))}
                    {tagKbIds.length > 0 && (
                      <div className="pt-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-muted-foreground">每块提取标签数</label>
                          <span className="text-xs">{topnTags}</span>
                        </div>
                        <input type="range" min={1} max={10} value={topnTags} onChange={(e) => setTopnTags(Number(e.target.value))} disabled={!canManage} className="w-full" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 自动元数据 */}
              <Separator />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={enableMetadata} onCheckedChange={(v) => setEnableMetadata(!!v)} disabled={!canManage} />
                  启用自动元数据
                </label>
                <Button variant="outline" size="sm" onClick={() => setMetadataOpen(true)} disabled={!canManage}>
                  <Settings2 className="h-4 w-4 mr-1" />配置字段
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {canManage && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={fetchDataset}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {saving ? "保存中…" : "保存配置"}
            </Button>
          </div>
        )}
      </div>

      {/* 右栏：切片方法说明 */}
      <Card className="hidden lg:block sticky top-4">
        <CardContent className="p-4 space-y-3">
          <div className="text-base font-medium">切片方法说明</div>
          {currentChunkMethod && (
            <div className="space-y-2">
              <div className="text-sm font-medium">{currentChunkMethod.label}</div>
              <p className="text-xs text-muted-foreground leading-relaxed">{currentChunkMethod.desc}</p>
            </div>
          )}
          <Separator />
          <div className="space-y-2">
            <div className="text-sm font-medium">PDF 布局识别</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              DeepDOC 能识别 PDF 标题、表格、图片位置，红头文件、扫描件建议使用；Plain Text 仅取纯文本，处理更快。
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="text-sm font-medium">自动关键词 / 问题</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              开启后由索引模型为每个分块自动提取关键词或问题，可提升检索命中率，但会额外消耗 Token。
            </p>
          </div>
        </CardContent>
      </Card>

      <MetadataDialog datasetId={datasetId} open={metadataOpen} onOpenChange={setMetadataOpen} />
    </div>
  )
}
