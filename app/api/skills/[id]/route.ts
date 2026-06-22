import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"

export const runtime = "nodejs"

const updateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  description: z.string().max(200).optional(),
  category: z.string().max(20).optional(),
  prompt: z.string().min(1).max(4000).optional(),
  enabled: z.boolean().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  const existing = db.prepare("SELECT id FROM custom_skills WHERE id = ?").get(id)
  if (!existing) return NextResponse.json({ error: "技能不存在或无法修改内置技能" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const { name, description, category, prompt, enabled } = parsed.data
  const sets: string[] = []
  const vals: unknown[] = []

  if (name !== undefined)        { sets.push("name = ?");                        vals.push(name) }
  if (description !== undefined) { sets.push("description = ?");                 vals.push(description) }
  if (category !== undefined)    { sets.push("category = ?");                    vals.push(category) }
  if (prompt !== undefined)      { sets.push("input_schema_description = ?");    vals.push(prompt) }
  if (enabled !== undefined)     { sets.push("enabled = ?");                     vals.push(enabled ? 1 : 0) }

  if (sets.length === 0) return NextResponse.json({ ok: true })

  vals.push(id)
  db.prepare(`UPDATE custom_skills SET ${sets.join(", ")} WHERE id = ?`).run(...vals)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  const existing = db.prepare("SELECT id FROM custom_skills WHERE id = ?").get(id)
  if (!existing) return NextResponse.json({ error: "技能不存在" }, { status: 404 })

  db.prepare("DELETE FROM custom_skills WHERE id = ?").run(id)
  return NextResponse.json({ ok: true })
}
