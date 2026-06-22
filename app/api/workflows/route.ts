import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"
import { PRESET_WORKFLOWS } from "@/lib/workflow/presets"

export const runtime = "nodejs"

type WfRow = { id: string; name: string; description: string; definition: string; enabled: number; created_by: string | null; created_at: string; updated_at: string }

function parseRow(row: WfRow) {
  return {
    id: row.id, name: row.name, description: row.description,
    definition: JSON.parse(row.definition),
    enabled: Boolean(row.enabled),
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  const rows = db.prepare("SELECT * FROM workflows ORDER BY created_at DESC").all() as WfRow[]
  return NextResponse.json({ workflows: rows.map(parseRow) })
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).default(""),
  definition: z.object({
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  }),
  preset: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)

  // Check if using a preset
  if (body?.preset !== undefined) {
    const idx = Number(body.preset)
    const preset = PRESET_WORKFLOWS[idx]
    if (!preset) return NextResponse.json({ error: "预设不存在" }, { status: 400 })
    const id = crypto.randomUUID()
    getDb().prepare(
      "INSERT INTO workflows (id,name,description,definition,created_by) VALUES (?,?,?,?,?)"
    ).run(id, preset.name, preset.description, JSON.stringify(preset.definition), user.sub)
    return NextResponse.json({ id }, { status: 201 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const { name, description, definition } = parsed.data
  const id = crypto.randomUUID()
  getDb().prepare(
    "INSERT INTO workflows (id,name,description,definition,created_by) VALUES (?,?,?,?,?)"
  ).run(id, name, description, JSON.stringify(definition), user.sub)

  return NextResponse.json({ id }, { status: 201 })
}
