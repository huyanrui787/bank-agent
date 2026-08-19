import { getDb } from "@/lib/db"

export type ChannelRow = {
  id: string
  name: string
  type: string
  enabled: number
  config: string
}

export type PushResult = {
  channelId: string
  channelName: string
  channelType: string
  status: "success" | "failed" | "skipped"
  error?: string
  pushedAt: string
}

/** 通用通知消息：各渠道自行映射到对应格式。 */
export type NotifyMessage = {
  title: string
  content: string
  receiver?: string
  smsName?: string
}

export function listEnabledChannels(): ChannelRow[] {
  return getDb()
    .prepare("SELECT * FROM notification_channels WHERE enabled = 1 ORDER BY created_at")
    .all() as ChannelRow[]
}

export async function dispatchToChannel(channel: ChannelRow, msg: NotifyMessage): Promise<PushResult> {
  const config = JSON.parse(channel.config || "{}") as Record<string, string>
  const pushedAt = new Date().toISOString()
  const base = { channelId: channel.id, channelName: channel.name, channelType: channel.type, pushedAt }

  try {
    if (channel.type === "wechat_webhook") {
      if (!config.webhookUrl) return { ...base, status: "failed", error: "未配置 Webhook URL" }
      const text = [`**${msg.title}**`, msg.content].filter(Boolean).join("\n")
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
        body: JSON.stringify({ title: msg.title, content: msg.content, receiver: msg.receiver ?? "" }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return { ...base, status: "failed", error: `HTTP ${res.status}` }
      return { ...base, status: "success" }
    }

    if (channel.type === "sms") {
      if (!config.smsAppKey || !config.smsTemplateCode) {
        return { ...base, status: "failed", error: "未配置短信 AppKey 或模板代码" }
      }
      const gatewayUrl = config.smsGatewayUrl || "https://dysmsapi.aliyuncs.com"
      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Action: "SendSms",
          AppKey: config.smsAppKey,
          TemplateCode: config.smsTemplateCode,
          SignName: config.smsSignName,
          TemplateParam: JSON.stringify({ title: msg.title.slice(0, 20), name: msg.smsName ?? "" }),
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

      const bodyTemplate = config.bodyTemplate || JSON.stringify({ title: "{{title}}", content: "{{content}}" })
      const body = bodyTemplate
        .replace(/\{\{title\}\}/g, msg.title)
        .replace(/\{\{content\}\}/g, msg.content)
        .replace(/\{\{receiver\}\}/g, msg.receiver ?? "")
        .replace(/\{\{customerName\}\}/g, msg.smsName ?? "")
        // 兼容预警推送的旧占位符
        .replace(/\{\{alertTitle\}\}/g, msg.title)
        .replace(/\{\{suggestedAction\}\}/g, msg.content)
        .replace(/\{\{managerName\}\}/g, msg.receiver ?? "")

      const res = await fetch(config.url, { method: "POST", headers, body, signal: AbortSignal.timeout(8000) })
      if (!res.ok) return { ...base, status: "failed", error: `HTTP ${res.status}` }
      return { ...base, status: "success" }
    }

    return { ...base, status: "skipped", error: `未知渠道类型: ${channel.type}` }
  } catch (err) {
    return { ...base, status: "failed", error: err instanceof Error ? err.message : String(err) }
  }
}

/** 向所有启用渠道推送（无渠道时静默返回空数组）。 */
export async function notifyAllChannels(msg: NotifyMessage): Promise<PushResult[]> {
  const channels = listEnabledChannels()
  if (channels.length === 0) return []
  return Promise.all(channels.map((ch) => dispatchToChannel(ch, msg)))
}
