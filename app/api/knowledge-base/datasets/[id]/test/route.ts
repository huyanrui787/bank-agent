import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { testRetrieval } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../_shared"

export const runtime = "nodejs"

const testSchema = z.object({
  query: z.string().min(1, "请输入检索问题"),
  topK: z.number().int().min(1).max(50).optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
  highlight: z.boolean().optional(),
})

// POST /api/knowledge-base/datasets/[id]/test — 检索测试
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = testSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  try {
    const result = await testRetrieval(id, parsed.data.query, {
      topK: parsed.data.topK,
      similarityThreshold: parsed.data.similarityThreshold,
      highlight: parsed.data.highlight,
    })
    return NextResponse.json(result)
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
