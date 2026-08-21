import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { deleteDocument, renameDocument, setDocumentEnabled, updateDocumentMetadata, downloadDocument } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../../_shared"

export const runtime = "nodejs"

// GET /api/knowledge-base/datasets/[id]/documents/[docId] — 下载文档（文件流）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { blob, filename, contentType } = await downloadDocument(id, docId)
    const headers = new Headers()
    headers.set("Content-Type", contentType)
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    return new NextResponse(blob, { headers })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  enabled: z.boolean().optional(),
  metaFields: z.record(z.string(), z.unknown()).optional(),
})

// PATCH /api/knowledge-base/datasets/[id]/documents/[docId] — 重命名 / 启用禁用 / 元数据
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  const d = parsed.data
  try {
    if (d.name !== undefined) await renameDocument(id, docId, d.name)
    if (d.enabled !== undefined) await setDocumentEnabled(id, docId, d.enabled)
    if (d.metaFields !== undefined) await updateDocumentMetadata(id, docId, d.metaFields)
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.update",
      resourceType: "knowledge_document",
      resourceId: docId,
      summary: `${user.name} 更新文档 ${docId}`,
      detail: { changedFields: Object.keys(d) },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

// DELETE /api/knowledge-base/datasets/[id]/documents/[docId]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    await deleteDocument(id, docId)
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.delete",
      resourceType: "knowledge_document",
      resourceId: docId,
      summary: `${user.name} 从知识库 ${id} 删除文档 ${docId}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
