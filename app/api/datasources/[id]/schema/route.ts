import { NextRequest, NextResponse } from "next/server"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { resolveDatasourceSchema } from "@/lib/db/datasource-schema"

export const runtime = "nodejs"

// GET /api/datasources/[id]/schema — 指定数据源的表结构数据字典
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_datasources")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const schema = await resolveDatasourceSchema(id)
  if (!schema) return NextResponse.json({ error: "数据源不存在或不可用" }, { status: 404 })
  return NextResponse.json(schema)
}
