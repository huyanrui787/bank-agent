import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"

export const runtime = "nodejs"

type DbChannel = { id: string; name: string; type: string; enabled: number; config: string; created_by: string | null; created_at: string; updated_at: string }

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

// GET /api/channels/[id] — return full config (unmasked, for edit form)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_channels")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const row = db.prepare("SELECT * FROM notification_channels WHERE id = ?").get(id) as DbChannel | undefined
  if (!row) return NextResponse.json({ error: "不存在" }, { status: 404 })

  return NextResponse.json({
    id: row.id, name: row.name, type: row.type,
    enabled: Boolean(row.enabled),
    config: JSON.parse(row.config || "{}"),
    createdAt: row.created_at,
  })
}

// PUT /api/channels/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_channels")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const existing = db.prepare("SELECT id, config FROM notification_channels WHERE id = ?").get(id) as { id: string; config: string } | undefined
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const sets: string[] = ["updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"]
  const vals: unknown[] = []

  if (parsed.data.name !== undefined)    { sets.push("name = ?");    vals.push(parsed.data.name) }
  if (parsed.data.enabled !== undefined) { sets.push("enabled = ?"); vals.push(parsed.data.enabled ? 1 : 0) }
  if (parsed.data.config !== undefined) {
    // Merge with existing config, preserving secrets if sent as "••••••••"
    const existing_config = JSON.parse(existing.config || "{}") as Record<string, unknown>
    const incoming = parsed.data.config as Record<string, unknown>
    const merged: Record<string, unknown> = { ...existing_config }
    for (const [k, v] of Object.entries(incoming)) {
      if (typeof v === "string" && v === "••••••••") continue // preserve existing secret
      merged[k] = v
    }
    sets.push("config = ?")
    vals.push(JSON.stringify(merged))
  }

  vals.push(id)
  db.prepare(`UPDATE notification_channels SET ${sets.join(", ")} WHERE id = ?`).run(...vals)
  return NextResponse.json({ ok: true })
}

// DELETE /api/channels/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_channels")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  db.prepare("DELETE FROM notification_channels WHERE id = ?").run(id)
  return NextResponse.json({ ok: true })
}
