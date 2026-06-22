import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"
import { writeAuditLog } from "@/lib/audit/log"

export const runtime = "nodejs"

const pushSchema = z.object({
  alertId: z.string(),
  alertTitle: z.string(),
  customerName: z.string().optional(),
  managerName: z.string().optional(),
  suggestedAction: z.string(),
  channelId: z.string().optional(), // if omitted, use first enabled channel
})

type ChannelRow = { id: string; name: string; type: string; enabled: number; config: string }

type PushResult = {
  channelId: string
  channelName: string
  channelType: string
  status: "success" | "failed" | "skipped"
  error?: string
  pushedAt: string
}

async function dispatchToChannel(channel: ChannelRow, payload: {
  alertTitle: string; customerName?: string; managerName?: string; suggestedAction: string
}): Promise<PushResult> {
  const config = JSON.parse(channel.config || "{}") as Record<string, string>
  const pushedAt = new Date().toISOString()
  const base = { channelId: channel.id, channelName: channel.name, channelType: channel.type, pushedAt }

  try {
    if (channel.type === "wechat_webhook") {
      if (!config.webhookUrl) return { ...base, status: "failed", error: "未配置 Webhook URL" }
      const text = [
        `📢 **业务预警通知**`,
        `预警：${payload.alertTitle}`,
        payload.customerName ? `客户：${payload.customerName}` : null,
        payload.managerName  ? `经理：${payload.managerName}` : null,
        `建议：${payload.suggestedAction}`,
        `时间：${new Date().toLocaleString("zh-CN")}`,
      ].filter(Boolean).join("\n")

      const res = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msgtype: "markdown", markdown: { content: text } }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return { ...base, status: "failed", error: `HTTP ${res.status}` }
      return { ...base, status: "success" }
    }

    if (channel.type === "longlong") {
      if (!config.longlongUrl) return { ...base, status: "failed", error: "未配置龙龙接口地址" }
      const res = await fetch(config.longlongUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.longlongToken ? { Authorization: `Bearer ${config.longlongToken}` } : {}),
        },
        body: JSON.stringify({
          title: payload.alertTitle,
          content: `${payload.customerName ? "客户：" + payload.customerName + " " : ""}${payload.suggestedAction}`,
          receiver: payload.managerName,
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return { ...base, status: "failed", error: `HTTP ${res.status}` }
      return { ...base, status: "success" }
    }

    if (channel.type === "sms") {
      // Aliyun SMS compatible interface
      if (!config.smsAppKey || !config.smsTemplateCode) {
        return { ...base, status: "failed", error: "未配置短信 AppKey 或模板代码" }
      }
      // POST to user-configured smsGatewayUrl or Aliyun endpoint
      const gatewayUrl = config.smsGatewayUrl || "https://dysmsapi.aliyuncs.com"
      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Action: "SendSms",
          AppKey: config.smsAppKey,
          TemplateCode: config.smsTemplateCode,
          SignName: config.smsSignName,
          TemplateParam: JSON.stringify({
            title: payload.alertTitle.slice(0, 20),
            name: payload.customerName ?? "",
          }),
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return { ...base, status: "failed", error: `HTTP ${res.status}` }
      return { ...base, status: "success" }
    }

    if (channel.type === "custom_webhook") {
      if (!config.url) return { ...base, status: "failed", error: "未配置 URL" }
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      try {
        const extra = config.headers ? JSON.parse(config.headers) : {}
        Object.assign(headers, extra)
      } catch { /* ignore malformed headers */ }

      const bodyTemplate = config.bodyTemplate || JSON.stringify({
        title: "{{alertTitle}}",
        customer: "{{customerName}}",
        action: "{{suggestedAction}}",
      })
      const body = bodyTemplate
        .replace(/\{\{alertTitle\}\}/g, payload.alertTitle)
        .replace(/\{\{customerName\}\}/g, payload.customerName ?? "")
        .replace(/\{\{managerName\}\}/g, payload.managerName ?? "")
        .replace(/\{\{suggestedAction\}\}/g, payload.suggestedAction)

      const res = await fetch(config.url, {
        method: "POST", headers, body,
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return { ...base, status: "failed", error: `HTTP ${res.status}` }
      return { ...base, status: "success" }
    }

    return { ...base, status: "skipped", error: `未知渠道类型: ${channel.type}` }
  } catch (err) {
    return { ...base, status: "failed", error: err instanceof Error ? err.message : String(err) }
  }
}

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = pushSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const { alertId, alertTitle, customerName, managerName, suggestedAction, channelId } = parsed.data

  const db = getDb()
  let channels: ChannelRow[]

  if (channelId) {
    const row = db.prepare("SELECT * FROM notification_channels WHERE id = ? AND enabled = 1").get(channelId) as ChannelRow | undefined
    channels = row ? [row] : []
  } else {
    channels = db.prepare("SELECT * FROM notification_channels WHERE enabled = 1 ORDER BY created_at").all() as ChannelRow[]
  }

  if (channels.length === 0) {
    return NextResponse.json({ error: "无可用通知渠道，请先在「渠道配置」中添加并启用渠道" }, { status: 422 })
  }

  const results = await Promise.all(
    channels.map((ch) => dispatchToChannel(ch, { alertTitle, customerName, managerName, suggestedAction }))
  )

  const successCount = results.filter((r) => r.status === "success").length

  writeAuditLog({
    actorId: user.sub,
    actorName: user.name,
    actorRole: user.role,
    actorBranch: user.branch,
    action: "alert.notification.push",
    resourceType: "alert",
    resourceId: alertId,
    summary: `${user.name} 推送预警「${alertTitle}」到 ${channels.length} 个渠道（成功 ${successCount} 个）`,
    detail: { alertId, results },
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: null,
  })

  return NextResponse.json({
    success: successCount > 0,
    total: channels.length,
    successCount,
    results,
  })
}

export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // Legacy: return empty history (push records not persisted to keep it simple)
  return NextResponse.json({ history: [] })
}
