import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"
import { BUILTIN_SKILLS } from "@/lib/agent/skill-store"

export const runtime = "nodejs"

// GET /api/skills — return builtin + custom skills
export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  const rows = db.prepare(
    "SELECT id, name, description, category, input_schema_description AS prompt, enabled, created_at FROM custom_skills ORDER BY created_at DESC"
  ).all() as { id: string; name: string; description: string; category: string; prompt: string; enabled: number; created_at: string }[]

  const builtins = BUILTIN_SKILLS.map((s) => ({ ...s, source: "builtin" as const, enabled: true }))
  const customs = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    category: r.category ?? "自定义",
    prompt: r.prompt ?? "",
    icon: "Sparkles",
    source: "custom" as const,
    enabled: Boolean(r.enabled),
    createdAt: r.created_at,
  }))

  return NextResponse.json({ skills: [...builtins, ...customs] })
}

const createSchema = z.object({
  name: z.string().min(1).max(40),
  description: z.string().max(200).default(""),
  category: z.string().max(20).default("自定义"),
  prompt: z.string().min(1, "提示词不能为空").max(4000),
})

// POST /api/skills — create custom skill
export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })
  }

  const { name, description, category, prompt } = parsed.data
  const id = crypto.randomUUID()
  const db = getDb()
  db.prepare(
    "INSERT INTO custom_skills (id, name, description, category, input_schema_description, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
  ).run(id, name, description, category, prompt)

  return NextResponse.json({ id }, { status: 201 })
}
