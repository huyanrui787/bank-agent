import { NextRequest, NextResponse } from "next/server"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { listIngestionLogs } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../../../_shared"

export const runtime = "nodejs"

// GET /api/knowledge-base/datasets/[id]/ingestions — 解析日志列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const page = Number(url.searchParams.get("page") ?? 1)
  const pageSize = Number(url.searchParams.get("page_size") ?? 20)

  try {
    const result = await listIngestionLogs(id, page, pageSize)
    return NextResponse.json(result)
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
