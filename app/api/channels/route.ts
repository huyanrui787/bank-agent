import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"

export const runtime = "nodejs"

export type ChannelType = "wechat_webhook" | "longlong" | "sms" | "custom_webhook"

export type ChannelConfig = {
  // wechat_webhook
  webhookUrl?: string
  // longlong
  longlongUrl?: string
  longlongToken?: string
  // sms
  smsAppKey?: string
  smsAppSecret?: string
  smsSignName?: string
  smsTemplateCode?: string
  // custom_webhook
  url?: string
  headers?: Record<string, string>
  bodyTemplate?: string
}

type DbChannel = {
  id: string
  name: string
  type: ChannelType
  enabled: number
  config: string
  created_by: string | null
  created_at: string
  updated_at: string
}

function parseChannel(row: DbChannel) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    enabled: Boolean(row.enabled),
    config: JSON.parse(row.config || "{}") as ChannelConfig,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// GET /api/channels
export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  const rows = db.prepare(
    "SELECT * FROM notification_channels ORDER BY created_at DESC"
  ).all() as DbChannel[]

  // Mask sensitive fields (secrets) in list view
  const channels = rows.map((row) => {
    const ch = parseChannel(row)
    if (ch.config.smsAppSecret) ch.config.smsAppSecret = "••••••••"
    if (ch.config.longlongToken) ch.config.longlongToken = "••••••••"
    return ch
  })

  return NextResponse.json({ channels })
}

const createSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["wechat_webhook", "longlong", "sms", "custom_webhook"]),
  config: z.record(z.string(), z.unknown()).default({}),
})

// POST /api/channels
export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["branch_admin"].includes(user.role)) {
    return NextResponse.json({ error: "仅分行管理员可配置通知渠道" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })
  }

  const { name, type, config } = parsed.data
  const id = crypto.randomUUID()
  const db = getDb()
  db.prepare(
    "INSERT INTO notification_channels (id, name, type, enabled, config, created_by) VALUES (?, ?, ?, 1, ?, ?)"
  ).run(id, name, type, JSON.stringify(config), user.sub)

  return NextResponse.json({ id }, { status: 201 })
}
