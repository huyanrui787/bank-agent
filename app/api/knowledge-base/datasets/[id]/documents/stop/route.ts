import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { stopParsing } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../../_shared"

export const runtime = "nodejs"

const schema = z.object({ docIds: z.array(z.string()).min(1) })

// POST /api/knowledge-base/datasets/[id]/documents/stop — 停止解析
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  try {
    await stopParsing(id, parsed.data.docIds)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
