import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { deleteDataset, getDataset, updateDataset } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../_shared"

export const runtime = "nodejs"

// GET /api/knowledge-base/datasets/[id] — 数据集详情（含配置字段）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const dataset = await getDataset(id)
    return NextResponse.json({ dataset })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(65535).optional(),
  chunkMethod: z.string().max(32).optional(),
  parserConfig: z.record(z.string(), z.unknown()).optional(),
  language: z.string().max(32).optional(),
  permission: z.string().max(16).optional(),
  pagerank: z.number().int().min(0).max(100).optional(),
  pipelineId: z.string().max(64).nullable().optional(),
  avatar: z.string().max(2_000_000).optional(),
})

// PUT /api/knowledge-base/datasets/[id] — 更新配置（切片方法 / 解析配置 / 名称 / 描述）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  try {
    await updateDataset(id, {
      name: parsed.data.name,
      description: parsed.data.description,
      chunkMethod: parsed.data.chunkMethod,
      parserConfig: parsed.data.parserConfig,
      language: parsed.data.language,
      permission: parsed.data.permission,
      pagerank: parsed.data.pagerank,
      pipelineId: parsed.data.pipelineId,
      avatar: parsed.data.avatar,
    })
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.update",
      resourceType: "knowledge_dataset",
      resourceId: id,
      summary: `${user.name} 更新知识库配置 ${id}`,
      detail: { changedFields: Object.keys(parsed.data) },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

// DELETE /api/knowledge-base/datasets/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    await deleteDataset(id)
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.delete",
      resourceType: "knowledge_dataset",
      resourceId: id,
      summary: `${user.name} 删除知识库 ${id}`,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
