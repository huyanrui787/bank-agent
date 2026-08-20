import { NextRequest, NextResponse } from "next/server"
import { getBusinessDataSource } from "@/lib/datasource"
import { userFromHeaders, buildScope } from "@/lib/auth/scope"

export const runtime = "nodejs"

/** 返回当前用户数据范围内可访问的客户清单（供客群梳理页使用）。 */
export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ds = getBusinessDataSource()
  const scope = buildScope(user)
  const customers = ds.filterCustomers({}, scope, user.role, 100000)
  return NextResponse.json({ customers })
}
