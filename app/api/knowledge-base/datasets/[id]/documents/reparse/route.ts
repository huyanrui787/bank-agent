import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { reparseDocuments } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../../_shared"

export const runtime = "nodejs"

const schema = z.object({
  docIds: z.array(z.string()).min(1),
  delete: z.boolean().optional(),
  applyKb: z.boolean().optional(),
})

// POST /api/knowledge-base/datasets/[id]/documents/reparse — 重新解析
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  try {
    await reparseDocuments(parsed.data.docIds, { delete: parsed.data.delete, applyKb: parsed.data.applyKb })
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.update",
      resourceType: "knowledge_document",
      resourceId: id,
      summary: `${user.name} 重新解析 ${parsed.data.docIds.length} 个文档`,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
