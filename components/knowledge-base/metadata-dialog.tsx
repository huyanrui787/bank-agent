"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type MetaField = { key: string; type: string; description?: string }

const FIELD_TYPES = [
  { value: "string", label: "字符串" },
  { value: "number", label: "数字" },
  { value: "time", label: "时间" },
  { value: "list", label: "列表" },
]

export function MetadataDialog({ datasetId, open, onOpenChange }: {
  datasetId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [fields, setFields] = useState<MetaField[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 打开弹窗时拉取元数据配置，属外部数据同步 */
    if (!open) return
    setLoading(true)
    fetch(`/api/knowledge-base/datasets/${datasetId}/metadata-config`)
      .then((r) => r.json())
      .then((d) => setFields(d.metadata ?? []))
      .catch(() => setFields([]))
      .finally(() => setLoading(false))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, datasetId])

  function addField() {
    setFields((p) => [...p, { key: "", type: "string" }])
  }
  function updateField(i: number, patch: Partial<MetaField>) {
    setFields((p) => p.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }
  function removeField(i: number) {
    setFields((p) => p.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    const valid = fields.filter((f) => f.key.trim())
    if (valid.some((f) => !f.type)) { toast.error("请为每个字段选择类型"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/metadata-config`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: valid, builtInMetadata: [] }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "保存失败"); return }
      toast.success("元数据配置已保存")
      onOpenChange(false)
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>自动元数据配置</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center"><Loader2 className="h-4 w-4 animate-spin" /> 加载…</div>
          ) : fields.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">还没有元数据字段，点击「添加字段」配置</p>
          ) : (
            fields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={f.key}
                  onChange={(e) => updateField(i, { key: e.target.value })}
                  placeholder="字段名（如 department）"
                  className="flex-1"
                />
                <Select value={f.type} onValueChange={(v) => updateField(i, { type: v })}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  value={f.description ?? ""}
                  onChange={(e) => updateField(i, { description: e.target.value })}
                  placeholder="描述（可选）"
                  className="w-32"
                />
                <button onClick={() => removeField(i)} className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={addField}><Plus className="h-4 w-4 mr-1" />添加字段</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
