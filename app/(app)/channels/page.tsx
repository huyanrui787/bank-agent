"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Wifi, WifiOff, Send, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { useUser } from "@/lib/hooks/use-user"
import { useRouter } from "next/navigation"

type ChannelType = "wechat_webhook" | "longlong" | "sms" | "custom_webhook"

type Channel = {
  id: string
  name: string
  type: ChannelType
  enabled: boolean
  config: Record<string, string>
  createdAt: string
}

const TYPE_LABELS: Record<ChannelType, string> = {
  wechat_webhook: "企业微信 Webhook",
  longlong:       "龙龙消息接口",
  sms:            "短信（阿里云兼容）",
  custom_webhook: "自定义 Webhook",
}

const TYPE_COLORS: Record<ChannelType, string> = {
  wechat_webhook: "bg-green-50 text-green-700",
  longlong:       "bg-blue-50 text-blue-700",
  sms:            "bg-purple-50 text-purple-700",
  custom_webhook: "bg-gray-100 text-gray-700",
}

// ── Config fields per type ────────────────────────────────────────────────────

type FieldDef = { key: string; label: string; placeholder: string; secret?: boolean; multiline?: boolean }

const FIELDS: Record<ChannelType, FieldDef[]> = {
  wechat_webhook: [
    { key: "webhookUrl", label: "Webhook URL", placeholder: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx" },
  ],
  longlong: [
    { key: "longlongUrl",   label: "接口地址",    placeholder: "https://your-longlong-server/api/notify" },
    { key: "longlongToken", label: "Authorization Token（可选）", placeholder: "Bearer xxxxxxxx", secret: true },
  ],
  sms: [
    { key: "smsAppKey",       label: "AppKey",         placeholder: "阿里云 AccessKey ID" },
    { key: "smsAppSecret",    label: "AppSecret",      placeholder: "阿里云 AccessKey Secret", secret: true },
    { key: "smsSignName",     label: "短信签名",        placeholder: "如：龙湾农商行" },
    { key: "smsTemplateCode", label: "模板 Code",       placeholder: "如：SMS_xxxxxxxxx" },
    { key: "smsGatewayUrl",   label: "网关地址（可选）", placeholder: "留空使用阿里云默认地址" },
  ],
  custom_webhook: [
    { key: "url",          label: "请求 URL",           placeholder: "https://your-server/webhook" },
    { key: "headers",      label: "请求头（JSON）",     placeholder: '{"Authorization":"Bearer xxx"}' },
    { key: "bodyTemplate", label: "Body 模板（JSON）",  placeholder: '{"title":"{{alertTitle}}","action":"{{suggestedAction}}"}', multiline: true },
  ],
}

// ── Channel form ──────────────────────────────────────────────────────────────

function ChannelForm({
  open, onOpenChange, initial, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  initial?: Channel; onSaved: () => void
}) {
  const [name, setName]         = useState("")
  const [type, setType]         = useState<ChannelType>("wechat_webhook")
  const [config, setConfig]     = useState<Record<string, string>>({})
  const [saving, setSaving]     = useState(false)
  const [testing, setTesting]   = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "")
      setType(initial?.type ?? "wechat_webhook")
      setConfig(initial?.config ?? {})
    }
  }, [open, initial])

  function setField(key: string, val: string) {
    setConfig((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("请填写渠道名称"); return }
    setSaving(true)
    try {
      const url = initial ? `/api/channels/${initial.id}` : "/api/channels"
      const method = initial ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, config }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? "保存失败"); return
      }
      toast.success(initial ? "已更新" : "渠道已创建")
      onSaved(); onOpenChange(false)
    } finally { setSaving(false) }
  }

  async function handleTest() {
    if (!initial) { toast.error("请先保存后再测试"); return }
    setTesting(true)
    try {
      const res = await fetch("/api/wechat-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertId: "test-001",
          alertTitle: "📡 渠道连通性测试",
          managerName: "系统",
          suggestedAction: "这是一条测试消息，请忽略。",
          channelId: initial.id,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.successCount > 0) {
        toast.success("发送成功，渠道连通正常")
      } else {
        const err = d.results?.[0]?.error ?? d.error ?? "发送失败"
        toast.error(`测试失败：${err}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误")
    } finally { setTesting(false) }
  }

  const fields = FIELDS[type] ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{initial ? "编辑渠道" : "新建通知渠道"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">渠道名称 <span className="text-red-500">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：企微运营群" maxLength={50} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">渠道类型</label>
            <Select value={type} onValueChange={(v) => { setType(v as ChannelType); setConfig({}) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(TYPE_LABELS) as [ChannelType, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-0.5">
            {type === "wechat_webhook" && <>在企业微信群中添加「群机器人」，复制 Webhook 地址填入下方。</>}
            {type === "longlong" && <>填写龙龙自建消息服务的接口地址（POST JSON）。</>}
            {type === "sms" && <>支持阿里云短信兼容接口，需提前在阿里云申请签名和模板。</>}
            {type === "custom_webhook" && <>自定义 HTTP POST 接口，Body 模板中可使用 {"{{alertTitle}}"} {"{{customerName}}"} {"{{managerName}}"} {"{{suggestedAction}}"} 占位符。</>}
          </div>

          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-sm font-medium">{f.label}</label>
              {f.multiline ? (
                <textarea
                  value={config[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              ) : (
                <Input
                  type={f.secret ? "password" : "text"}
                  value={config[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}

          {initial && (
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="w-full">
              <Send className={`h-4 w-4 mr-1.5 ${testing ? "animate-pulse" : ""}`} />
              {testing ? "发送中…" : "发送测试消息"}
            </Button>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [channels, setChannels] = useState<Channel[]>([])
  const [fetching, setFetching] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Channel | undefined>()

  useEffect(() => {
    if (!loading && user && user.role !== "branch_admin") router.replace("/")
  }, [user, loading, router])

  const fetchChannels = useCallback(async () => {
    setFetching(true)
    try {
      const res = await fetch("/api/channels")
      if (!res.ok) return
      const d = await res.json()
      setChannels(d.channels ?? [])
    } finally { setFetching(false) }
  }, [])

  useEffect(() => {
    if (user?.role === "branch_admin") fetchChannels()
  }, [user, fetchChannels])

  async function toggleEnabled(ch: Channel) {
    await fetch(`/api/channels/${ch.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !ch.enabled }),
    })
    await fetchChannels()
  }

  async function handleDelete(ch: Channel) {
    if (!confirm(`确定删除渠道「${ch.name}」？`)) return
    await fetch(`/api/channels/${ch.id}`, { method: "DELETE" })
    toast.success("已删除")
    await fetchChannels()
  }

  function openEdit(ch: Channel) {
    fetch(`/api/channels/${ch.id}`)
      .then((r) => r.json())
      .then((d) => { setEditing(d); setFormOpen(true) })
      .catch(() => { setEditing(ch); setFormOpen(true) })
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>
  if (!user || user.role !== "branch_admin") return null

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">通知渠道配置</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            配置企业微信、龙龙、短信等消息通知渠道，用于预警推送。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchChannels} disabled={fetching}>
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => { setEditing(undefined); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> 新建渠道
          </Button>
        </div>
      </div>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-3 text-muted-foreground">
            <Wifi className="h-10 w-10 opacity-30" />
            <p className="text-sm">还没有配置通知渠道</p>
            <Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setFormOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> 添加第一个渠道
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <Card key={ch.id} className={ch.enabled ? "" : "opacity-60"}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${ch.enabled ? "bg-primary/10" : "bg-muted"}`}>
                  {ch.enabled
                    ? <Wifi className="h-4 w-4 text-primary" />
                    : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{ch.name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_COLORS[ch.type]}`}>
                      {TYPE_LABELS[ch.type]}
                    </span>
                    {ch.enabled
                      ? <Badge variant="success" className="text-[10px]">启用中</Badge>
                      : <Badge variant="muted" className="text-[10px]">已停用</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ch.type === "wechat_webhook" && (ch.config.webhookUrl ? `URL: ${ch.config.webhookUrl.slice(0, 60)}…` : "未配置 Webhook URL")}
                    {ch.type === "longlong" && (ch.config.longlongUrl ? `URL: ${ch.config.longlongUrl.slice(0, 60)}` : "未配置接口地址")}
                    {ch.type === "sms" && (ch.config.smsAppKey ? `AppKey: ${ch.config.smsAppKey} · 签名: ${ch.config.smsSignName ?? "未设置"}` : "未配置")}
                    {ch.type === "custom_webhook" && (ch.config.url ? `URL: ${ch.config.url.slice(0, 60)}` : "未配置 URL")}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleEnabled(ch)}
                    className="h-8 px-2 rounded text-xs border border-border hover:bg-accent transition-colors"
                    title={ch.enabled ? "停用" : "启用"}
                  >
                    {ch.enabled ? "停用" : "启用"}
                  </button>
                  <button onClick={() => openEdit(ch)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(ch)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ChannelForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={fetchChannels}
      />
    </div>
  )
}
