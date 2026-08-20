import { NextRequest, NextResponse } from "next/server"
import { getBusinessDataSource } from "@/lib/datasource"
import { userFromHeaders, buildScope } from "@/lib/auth/scope"

export const runtime = "nodejs"

/** 返回当前用户数据范围内可访问的业务预警（供业务预警页使用）。 */
export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const ds = getBusinessDataSource()
  const scope = buildScope(user)
  const alerts = ds.scanAlerts({}, scope, 100000)
  return NextResponse.json({ alerts })
}
