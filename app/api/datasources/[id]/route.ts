import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"

export const runtime = "nodejs"

type DsRow = { id: string; name: string; type: string; host: string | null; port: number | null; database_name: string | null; username: string | null; password_enc: string | null; extra_config: string; enabled: number; created_at: string }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "branch_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const row = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(id) as DsRow | undefined
  if (!row) return NextResponse.json({ error: "不存在" }, { status: 404 })

  return NextResponse.json({
    id: row.id, name: row.name, type: row.type,
    host: row.host, port: row.port, databaseName: row.database_name,
    username: row.username, hasPassword: !!row.password_enc,
    extraConfig: JSON.parse(row.extra_config || "{}"),
    enabled: Boolean(row.enabled), createdAt: row.created_at,
  })
}

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  host: z.string().max(200).optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  databaseName: z.string().max(200).optional(),
  username: z.string().max(200).optional(),
  password: z.string().max(500).optional(),
  extraConfig: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "branch_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const existing = db.prepare("SELECT id FROM data_sources WHERE id = ?").get(id)
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const sets: string[] = ["updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"]
  const vals: unknown[] = []
  const d = parsed.data

  if (d.name !== undefined)       { sets.push("name = ?");          vals.push(d.name) }
  if (d.host !== undefined)       { sets.push("host = ?");          vals.push(d.host) }
  if (d.port !== undefined)       { sets.push("port = ?");          vals.push(d.port) }
  if (d.databaseName !== undefined) { sets.push("database_name = ?"); vals.push(d.databaseName) }
  if (d.username !== undefined)   { sets.push("username = ?");      vals.push(d.username) }
  if (d.password !== undefined && d.password !== "••••••••") {
    sets.push("password_enc = ?")
    vals.push(d.password ? Buffer.from(d.password).toString("base64") : null)
  }
  if (d.extraConfig !== undefined) { sets.push("extra_config = ?"); vals.push(JSON.stringify(d.extraConfig)) }
  if (d.enabled !== undefined)    { sets.push("enabled = ?");       vals.push(d.enabled ? 1 : 0) }

  vals.push(id)
  db.prepare(`UPDATE data_sources SET ${sets.join(", ")} WHERE id = ?`).run(...vals)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "branch_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  getDb().prepare("DELETE FROM data_sources WHERE id = ?").run(id)
  return NextResponse.json({ ok: true })
}
