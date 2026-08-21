import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { listChunks, createChunk, deleteChunks, setChunksAvailable } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../../../_shared"

export const runtime = "nodejs"

// GET /api/knowledge-base/datasets/[id]/documents/[docId]/chunks — chunk 列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const page = Number(url.searchParams.get("page") ?? 1)
  const pageSize = Number(url.searchParams.get("page_size") ?? 20)

  try {
    const result = await listChunks(id, docId, page, pageSize)
    return NextResponse.json(result)
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

const createSchema = z.object({ content: z.string().min(1) })

// POST /api/knowledge-base/datasets/[id]/documents/[docId]/chunks — 新建 chunk
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  try {
    await createChunk(id, docId, parsed.data.content)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

const deleteSchema = z.object({ chunkIds: z.array(z.string()).min(1) })

// DELETE /api/knowledge-base/datasets/[id]/documents/[docId]/chunks — 删除 chunk
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  try {
    await deleteChunks(id, docId, parsed.data.chunkIds)
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.update",
      resourceType: "knowledge_chunk",
      resourceId: docId,
      summary: `${user.name} 删除文档 ${docId} 的 ${parsed.data.chunkIds.length} 个 chunk`,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

const switchSchema = z.object({ chunkIds: z.array(z.string()).min(1), available: z.boolean() })

// PATCH /api/knowledge-base/datasets/[id]/documents/[docId]/chunks — 批量启用/禁用 chunk
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = switchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  try {
    await setChunksAvailable(id, docId, parsed.data.chunkIds, parsed.data.available)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
