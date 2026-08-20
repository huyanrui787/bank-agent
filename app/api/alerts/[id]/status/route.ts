import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { getBusinessDataSource } from "@/lib/datasource"
import { userFromHeaders, buildScope } from "@/lib/auth/scope"
import { writeAuditLog } from "@/lib/audit/log"

export const runtime = "nodejs"

const schema = z.object({
  status: z.enum(["pending", "processing", "done"]),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }

  const { status } = parsed.data
  const db = getDb()
  const scope = buildScope(user)
  const ds = getBusinessDataSource()

  // Verify alert is in scope
  const alert = ds.getAlert(id, scope)

  if (!alert) {
    return NextResponse.json({ error: "预警不存在或无权操作" }, { status: 404 })
  }

  const prevStatus = alert.status
  db.prepare("UPDATE alerts SET status = ? WHERE id = ?").run(status, id)

  writeAuditLog({
    actorId: user.sub,
    actorName: user.name,
    actorRole: user.role,
    actorBranch: user.branch,
    action: "alert.status.update",
    resourceType: "alert",
    resourceId: id,
    summary: `${user.name} 将预警 ${alert.title ?? id} 状态从 ${prevStatus} 改为 ${status}`,
    detail: { alertId: id, from: prevStatus, to: status },
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: scope.label,
  })

  return NextResponse.json({ ok: true, id, status })
}
