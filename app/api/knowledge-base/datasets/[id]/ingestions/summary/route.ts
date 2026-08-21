import { NextRequest, NextResponse } from "next/server"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { getIngestionSummary } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../../_shared"

export const runtime = "nodejs"

// GET /api/knowledge-base/datasets/[id]/ingestions/summary — 解析状态汇总
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const summary = await getIngestionSummary(id)
    return NextResponse.json({ summary })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
