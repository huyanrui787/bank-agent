import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { listDatasets, createDataset } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../_shared"

export const runtime = "nodejs"

// GET /api/knowledge-base/datasets — 数据集列表（全角色可读，供检索/知识库页）
export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const datasets = await listDatasets()
    return NextResponse.json({ datasets })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_knowledge")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  try {
    const ds = await createDataset(parsed.data.name, parsed.data.description)
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "admin.knowledge.create",
      resourceType: "knowledge_dataset",
      resourceId: ds.id,
      summary: `${user.name} 新建知识库「${ds.name}」`,
      detail: { name: ds.name, description: parsed.data.description ?? null },
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return NextResponse.json({ dataset: ds }, { status: 201 })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
