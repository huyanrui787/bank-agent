import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { queryAuditLogs, verifyChainIntegrity } from "@/lib/audit/log"

export const runtime = "nodejs"

const querySchema = z.object({
  actorId:      z.string().optional(),
  action:       z.string().optional(),
  resourceType: z.string().optional(),
  from:         z.string().optional(),
  to:           z.string().optional(),
  page:         z.coerce.number().int().min(1).default(1),
  pageSize:     z.coerce.number().int().min(1).max(100).default(50),
  verifyChain:  z.coerce.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "view_audit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries())
  const params = querySchema.safeParse(sp)
  if (!params.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }

  const { verifyChain, ...queryParams } = params.data
  const { rows, total } = queryAuditLogs(queryParams)

  const result: Record<string, unknown> = { rows, total, page: queryParams.page, pageSize: queryParams.pageSize }

  if (verifyChain) {
    result.chainIntegrity = verifyChainIntegrity()
  }

  return NextResponse.json(result)
}
