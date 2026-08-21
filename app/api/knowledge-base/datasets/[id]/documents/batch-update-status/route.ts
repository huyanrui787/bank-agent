import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { batchSetDocumentStatus } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../../_shared"

export const runtime = "nodejs"

const schema = z.object({
  docIds: z.array(z.string()).min(1),
  enabled: z.boolean(),
})

// POST /api/knowledge-base/datasets/[id]/documents/batch-update-status — 批量启用/禁用
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  try {
    await batchSetDocumentStatus(id, parsed.data.docIds, parsed.data.enabled)
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.update",
      resourceType: "knowledge_document",
      resourceId: id,
      summary: `${user.name} 批量${parsed.data.enabled ? "启用" : "禁用"} ${parsed.data.docIds.length} 个文档`,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
