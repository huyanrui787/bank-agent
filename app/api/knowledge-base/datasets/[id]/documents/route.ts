import { NextRequest, NextResponse } from "next/server"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { listDocuments, uploadDocuments, createEmptyDocument } from "@/lib/ragflow/client"
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

// POST /api/knowledge-base/datasets/[id]/documents — 上传文档（multipart: 多 file）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // 空文件分支：JSON body { name }（Content-Type 为 application/json）
  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null)
    const name = String(body?.name ?? "").trim()
    if (!name) return NextResponse.json({ error: "请填写文件名" }, { status: 400 })
    try {
      await createEmptyDocument(id, name)
      writeAuditLog({
        actorId: user.sub,
        actorName: user.name,
        actorRole: user.role,
        actorBranch: user.branch,
        action: "admin.knowledge.upload",
        resourceType: "knowledge_document",
        resourceId: id,
        summary: `${user.name} 在知识库 ${id} 新建空文件「${name}」`,
        ipAddress: req.headers.get("x-forwarded-for") ?? null,
        requestId: req.headers.get("x-request-id") ?? null,
        dataScope: null,
      })
      return NextResponse.json({ ok: true }, { status: 201 })
    } catch (err) {
      return ragflowErrorResponse(err)
    }
  }

  const formData = await req.formData().catch(() => null)
  const files = (formData?.getAll("file") ?? []).filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 })
  }

  try {
    await uploadDocuments(id, files)
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.upload",
      resourceType: "knowledge_document",
      resourceId: id,
      summary: `${user.name} 向知识库 ${id} 上传 ${files.length} 个文档`,
      detail: { fileNames: files.map((f) => f.name), count: files.length },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
