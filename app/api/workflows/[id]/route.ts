import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"

export const runtime = "nodejs"

type WfRow = { id: string; name: string; description: string; definition: string; enabled: number; created_by: string | null; created_at: string; updated_at: string }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const row = getDb().prepare("SELECT * FROM workflows WHERE id = ?").get(id) as WfRow | undefined
  if (!row) return NextResponse.json({ error: "不存在" }, { status: 404 })
  return NextResponse.json({ id: row.id, name: row.name, description: row.description, definition: JSON.parse(row.definition), enabled: Boolean(row.enabled) })
}

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
  definition: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }).optional(),
  enabled: z.boolean().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const existing = getDb().prepare("SELECT id FROM workflows WHERE id = ?").get(id)
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const sets: string[] = ["updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"]
  const vals: unknown[] = []
  const d = parsed.data
  if (d.name !== undefined)        { sets.push("name = ?");        vals.push(d.name) }
  if (d.description !== undefined) { sets.push("description = ?"); vals.push(d.description) }
  if (d.definition !== undefined)  { sets.push("definition = ?");  vals.push(JSON.stringify(d.definition)) }
  if (d.enabled !== undefined)     { sets.push("enabled = ?");     vals.push(d.enabled ? 1 : 0) }
  vals.push(id)
  getDb().prepare(`UPDATE workflows SET ${sets.join(", ")} WHERE id = ?`).run(...vals)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  getDb().prepare("DELETE FROM workflows WHERE id = ?").run(id)
  return NextResponse.json({ ok: true })
}
