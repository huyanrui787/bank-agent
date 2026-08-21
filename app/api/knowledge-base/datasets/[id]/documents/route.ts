import { NextRequest, NextResponse } from "next/server"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { listDocuments, uploadDocument } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../_shared"

export const runtime = "nodejs"

// GET /api/knowledge-base/datasets/[id]/documents — 文档列表（含解析状态/进度）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const documents = await listDocuments(id)
    return NextResponse.json({ documents })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

// POST /api/knowledge-base/datasets/[id]/documents — 上传文档（multipart: file）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const formData = await req.formData().catch(() => null)
  const file = formData?.get("file")
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 })
  }

  try {
    await uploadDocument(id, file)
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.upload",
      resourceType: "knowledge_document",
      resourceId: id,
      summary: `${user.name} 向知识库 ${id} 上传文档「${file.name}」`,
      detail: { fileName: file.name, size: file.size },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
