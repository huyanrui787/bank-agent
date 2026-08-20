import { NextRequest, NextResponse } from "next/server"
import { userFromHeaders } from "@/lib/auth/scope"
import { getDefaultSchema } from "@/lib/db/schema-info"

export const runtime = "nodejs"

// GET /api/schema — 默认库 bank.db 的业务表数据字典（供选表 UI 与 NL2SQL）
export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(getDefaultSchema())
}
