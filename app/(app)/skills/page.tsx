"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ShieldAlert, Scale, AlignLeft, Megaphone, Building2, PhoneCall,
  Eye, Plus, Pencil, Trash2, Sparkles, RotateCcw, Upload,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import {
  getLoadedSkillIds, toggleSkill,
  getSkillPromptOverride, setSkillPromptOverride, clearSkillPromptOverride,
  type Skill,
} from "@/lib/agent/skill-store"

const iconMap: Record<string, React.ElementType> = {
  ShieldAlert, Scale, AlignLeft, Megaphone, Building2, PhoneCall, Sparkles,
}

const categoryColor: Record<string, string> = {
  风控: "bg-red-50 text-red-700",
  合规: "bg-amber-50 text-amber-700",
  输出: "bg-sky-50 text-sky-700",
  营销: "bg-emerald-50 text-emerald-700",
  管理: "bg-violet-50 text-violet-700",
  自定义: "bg-gray-100 text-gray-700",
}

// ── Skill detail dialog ────────────────────────────────────────────────────────

function SkillDetailDialog({
  skill, loaded, onToggle, open, onOpenChange, onEdit,
}: {
  skill: Skill; loaded: boolean; onToggle: () => void
  open: boolean; onOpenChange: (v: boolean) => void; onEdit: () => void
}) {
  const Icon = iconMap[skill.icon] ?? Sparkles
  const override = typeof window !== "undefined" ? getSkillPromptOverride(skill.id) : null
  const displayPrompt = override ?? skill.prompt
  const hasOverride = override !== null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              loaded ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                {skill.name}
                {hasOverride && <Badge variant="warning" className="text-[10px]">已自定义</Badge>}
              </DialogTitle>
              <span className={cn(
                "mt-0.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                categoryColor[skill.category] ?? "bg-muted text-muted-foreground"
              )}>
                {skill.category}
              </span>
            </div>
          </div>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              注入的 Prompt 片段
            </div>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Pencil className="h-3 w-3" /> 编辑提示词
            </button>
          </div>
          <pre className="text-xs leading-5 bg-muted/50 rounded-md p-3 max-h-56 overflow-auto scrollbar-thin whitespace-pre-wrap font-mono">
            {displayPrompt}
          </pre>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-muted-foreground">
            {loaded ? "此 Skill 已注入 AI 上下文" : "加载后将注入 AI 上下文"}
          </div>
          <Button size="sm" variant={loaded ? "outline" : "default"}
            onClick={() => { onToggle(); onOpenChange(false) }}>
            {loaded ? "卸载 Skill" : "加载 Skill"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Skill card ─────────────────────────────────────────────────────────────────

function SkillCard({
  skill, loaded, onToggle, onDetail, onEdit, onDelete,
}: {
  skill: Skill; loaded: boolean; onToggle: () => void; onDetail: () => void
  onEdit: () => void; onDelete?: () => void
}) {
  const Icon = iconMap[skill.icon] ?? Sparkles
  const hasOverride = skill.source === "builtin" && typeof window !== "undefined"
    && getSkillPromptOverride(skill.id) !== null

  return (
    <div className={cn(
      "rounded-xl border p-5 flex flex-col gap-4 transition-all",
      loaded ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            loaded ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold leading-tight">{skill.name}</span>
              {skill.source === "custom" && <Badge variant="info" className="text-[10px]">自定义</Badge>}
              {hasOverride && <Badge variant="warning" className="text-[10px]">已修改</Badge>}
            </div>
            <span className={cn(
              "mt-0.5 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full",
              categoryColor[skill.category] ?? "bg-muted text-muted-foreground"
            )}>
              {skill.category}
            </span>
          </div>
        </div>
        <div className="shrink-0 mt-0.5">
          {loaded ? <Badge variant="success" className="text-[10px]">已加载</Badge>
                  : <Badge variant="muted" className="text-[10px]">未加载</Badge>}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-5 line-clamp-2">{skill.description}</p>

      <div className="mt-auto pt-2 border-t border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onDetail}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Eye className="h-3 w-3" /> 查看
          </button>
          <button onClick={onEdit}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Pencil className="h-3 w-3" /> 编辑
          </button>
          {onDelete && (
            <button onClick={onDelete}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-600">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <button onClick={onToggle}
          className={cn("text-[11px] font-medium transition-colors",
            loaded ? "text-primary hover:text-primary/70" : "text-muted-foreground hover:text-foreground")}>
          {loaded ? "卸载" : "加载"}
        </button>
      </div>
    </div>
  )
}

// ── Skill form sheet ───────────────────────────────────────────────────────────

function SkillFormSheet({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  initial?: Skill; onSave: (data: { name: string; description: string; category: string; prompt: string }) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("自定义")
  const [prompt, setPrompt] = useState("")
  const [saving, setSaving] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)

  // 打开时重置表单（渲染期调整状态，避免 effect 内同步 setState）
  if (open && !wasOpen) {
    setWasOpen(true)
    setName(initial?.name ?? "")
    setDescription(initial?.description ?? "")
    setCategory(initial?.category ?? "自定义")
    // For builtin, use override if present
    const p = initial
      ? (initial.source === "builtin" ? (getSkillPromptOverride(initial.id) ?? initial.prompt) : initial.prompt)
      : ""
    setPrompt(p)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("请填写名称"); return }
    if (!prompt.trim()) { toast.error("提示词不能为空"); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description, category, prompt })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const isBuiltinEdit = initial?.source === "builtin"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {isBuiltinEdit ? `编辑提示词：${initial?.name}` : (initial ? "编辑 Skill" : "新建自定义 Skill")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!isBuiltinEdit && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">名称 <span className="text-red-500">*</span></label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：数据分析专家" maxLength={40} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">描述</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="一句话说明 Skill 的作用" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">分类</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["风控", "合规", "营销", "管理", "输出", "自定义"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">提示词内容 <span className="text-red-500">*</span></label>
            <p className="text-xs text-muted-foreground">这段文本将直接注入 AI 的 System Prompt，每次对话时生效。</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={14}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              placeholder="## 行为规范：…&#10;在回答时，你必须：&#10;1. …"
            />
          </div>
          {isBuiltinEdit && getSkillPromptOverride(initial!.id) !== null && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => { clearSkillPromptOverride(initial!.id); setPrompt(initial!.prompt); toast.success("已恢复默认提示词") }}
            >
              <RotateCcw className="h-3 w-3" /> 恢复默认提示词
            </button>
          )}
        </div>

        <SheetFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Import sheet ───────────────────────────────────────────────────────────────

function ImportSheet({ open, onOpenChange, onImported }: {
  open: boolean; onOpenChange: (v: boolean) => void; onImported: () => void
}) {
  const [text, setText] = useState("")
  const [importing, setImporting] = useState(false)

  async function handleImport() {
    let parsed: unknown
    try {
      parsed = JSON.parse(text.trim())
    } catch {
      toast.error("JSON 解析失败，请检查格式"); return
    }
    const list = Array.isArray(parsed) ? parsed : [parsed]
    if (list.length === 0) { toast.error("未解析到任何技能"); return }
    let ok = 0, fail = 0
    setImporting(true)
    try {
      for (const item of list) {
        const s = item as { name?: string; description?: string; category?: string; prompt?: string }
        if (!s?.name || !s?.prompt) { fail++; continue }
        const res = await fetch("/api/skills", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: s.name, description: s.description ?? "", category: s.category ?? "自定义", prompt: s.prompt }),
        })
        if (res.ok) ok++; else fail++
      }
      toast.success(`导入完成：成功 ${ok} 个，失败 ${fail} 个`)
      if (ok > 0) { onImported(); onOpenChange(false) }
    } finally { setImporting(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader><SheetTitle>批量导入 Skill</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">粘贴 JSON 数组，每项含 name / description / category / prompt。</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={16}
            placeholder={'[\n  {"name": "营销话术专家", "description": "生成个性化营销话术", "category": "营销", "prompt": "你是…"}\n]'}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
        </div>
        <SheetFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleImport} disabled={importing}>{importing ? "导入中…" : "导入"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loadedIds, setLoadedIds] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null)
  const [editingSkill, setEditingSkill] = useState<Skill | undefined>()
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills")
      if (!res.ok) return
      const data = await res.json()
      setSkills(data.skills ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 客户端挂载后一次性水合 localStorage 状态（SSR 由 mounted 门控） */
    setLoadedIds(getLoadedSkillIds())
    setMounted(true)
    fetchSkills()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fetchSkills])

  function handleToggle(id: string) {
    setLoadedIds(toggleSkill(id))
  }

  function openNew() { setEditingSkill(undefined); setFormOpen(true) }
  function openEdit(skill: Skill) { setEditingSkill(skill); setFormOpen(true) }

  async function handleSave(data: { name: string; description: string; category: string; prompt: string }) {
    if (editingSkill?.source === "builtin") {
      // Override stored in localStorage
      setSkillPromptOverride(editingSkill.id, data.prompt)
      toast.success("提示词已保存（本地存储）")
      await fetchSkills()
      return
    }
    if (editingSkill?.source === "custom") {
      const res = await fetch(`/api/skills/${editingSkill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) { toast.error("保存失败"); return }
      toast.success("已更新")
    } else {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) { toast.error("创建失败"); return }
      toast.success("已创建")
    }
    await fetchSkills()
  }

  async function handleDelete(skill: Skill) {
    if (!confirm(`确定删除「${skill.name}」？`)) return
    const res = await fetch(`/api/skills/${skill.id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("删除失败"); return }
    toast.success("已删除")
    setLoadedIds((ids) => ids.filter((x) => x !== skill.id))
    await fetchSkills()
  }

  const loadedCount = loadedIds.length
  const loadedNames = loadedIds.map((id) => skills.find((s) => s.id === id)?.name).filter(Boolean).join("、")

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Skill Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Skill 是注入 AI 上下文的行为规范片段。加载后，AI 的回答风格和视角会真实改变。支持自定义创建。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loadedCount > 0 ? <Badge variant="success">{loadedCount} 个已加载</Badge> : <Badge variant="muted">暂无加载</Badge>}
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> 导入
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> 新建 Skill
          </Button>
        </div>
      </div>

      {loadedCount > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <span className="font-medium">当前已加载：</span>{loadedNames}
          。这些规范已注入 AI 上下文，下次对话将生效。
        </div>
      )}

      {mounted && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              loaded={loadedIds.includes(skill.id)}
              onToggle={() => handleToggle(skill.id)}
              onDetail={() => setDetailSkill(skill)}
              onEdit={() => openEdit(skill)}
              onDelete={skill.source === "custom" ? () => handleDelete(skill) : undefined}
            />
          ))}
        </div>
      )}

      {detailSkill && (
        <SkillDetailDialog
          skill={detailSkill}
          loaded={loadedIds.includes(detailSkill.id)}
          onToggle={() => handleToggle(detailSkill.id)}
          open={!!detailSkill}
          onOpenChange={(v) => { if (!v) setDetailSkill(null) }}
          onEdit={() => { setDetailSkill(null); openEdit(detailSkill) }}
        />
      )}

      <SkillFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editingSkill}
        onSave={handleSave}
      />

      <ImportSheet open={importOpen} onOpenChange={setImportOpen} onImported={fetchSkills} />
    </div>
  )
}
