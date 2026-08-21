import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { getMetadataConfig, updateMetadataConfig } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../_shared"

export const runtime = "nodejs"

// GET /api/knowledge-base/datasets/[id]/metadata-config — 自动元数据配置
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const config = await getMetadataConfig(id)
    return NextResponse.json(config)
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

const fieldSchema = z.object({
  key: z.string().min(1).max(128),
  type: z.enum(["string", "list", "time", "number"]),
  description: z.string().max(500).optional(),
  enum: z.array(z.string()).optional(),
})
const schema = z.object({
  metadata: z.array(fieldSchema),
  builtInMetadata: z.array(fieldSchema),
})

// PUT /api/knowledge-base/datasets/[id]/metadata-config — 更新自动元数据配置
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  try {
    await updateMetadataConfig(id, parsed.data.metadata, parsed.data.builtInMetadata)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
