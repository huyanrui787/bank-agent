import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"
import { writeAuditLog } from "@/lib/audit/log"
import { dispatchToChannel, listEnabledChannels, type ChannelRow } from "@/lib/channels/dispatch"

export const runtime = "nodejs"

const pushSchema = z.object({
  alertId: z.string(),
  alertTitle: z.string(),
  customerName: z.string().optional(),
  managerName: z.string().optional(),
  suggestedAction: z.string(),
  channelId: z.string().optional(), // if omitted, use all enabled channels
})

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = pushSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const { alertId, alertTitle, customerName, managerName, suggestedAction, channelId } = parsed.data

  let channels: ChannelRow[]
  if (channelId) {
    const row = getDb()
      .prepare("SELECT * FROM notification_channels WHERE id = ? AND enabled = 1")
      .get(channelId) as ChannelRow | undefined
    channels = row ? [row] : []
  } else {
    channels = listEnabledChannels()
  }

  if (channels.length === 0) {
    return NextResponse.json({ error: "无可用通知渠道，请先在「渠道配置」中添加并启用渠道" }, { status: 422 })
  }

  const content = [
    `预警：${alertTitle}`,
    customerName ? `客户：${customerName}` : null,
    managerName ? `经理：${managerName}` : null,
    `建议：${suggestedAction}`,
    `时间：${new Date().toLocaleString("zh-CN")}`,
  ].filter(Boolean).join("\n")

  const results = await Promise.all(
    channels.map((ch) => dispatchToChannel(ch, {
      title: "📢 业务预警通知",
      content,
      receiver: managerName,
      smsName: customerName,
    }))
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
