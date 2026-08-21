import { NextRequest, NextResponse } from "next/server"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { listModels } from "@/lib/ragflow/client"
import { ragflowErrorResponse } from "../_shared"

export const runtime = "nodejs"

// GET /api/knowledge-base/models — embedding 模型列表
export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "ai_chat")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const models = await listModels()
    return NextResponse.json({ models })
  } catch (err) {
    return ragflowErrorResponse(err)
  }
}
