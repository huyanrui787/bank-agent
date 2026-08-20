import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can, ACTIONS } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { getRole, updateRole, deleteRole } from "@/lib/rbac/roles"

export const runtime = "nodejs"

const updateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  dataScope: z.enum(["personal", "branch", "bank"]).optional(),
  maskPii: z.boolean().optional(),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).max(50).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const role = getRole(code)
  if (!role) return NextResponse.json({ error: "不存在" }, { status: 404 })
  return NextResponse.json({ role })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  const d = parsed.data
  if (d.permissions !== undefined) {
    const invalid = d.permissions.filter((a) => !(a in ACTIONS))
    if (invalid.length) return NextResponse.json({ error: `未知权限：${invalid.join(", ")}` }, { status: 400 })
  }
  if (!updateRole(code, d)) return NextResponse.json({ error: "不存在" }, { status: 404 })

  writeAuditLog({
    actorId: user.sub, actorName: user.name, actorRole: user.role, actorBranch: user.branch,
    action: "admin.role.update", resourceType: "role", resourceId: code,
    summary: `${user.name} 更新角色 ${code}`,
    detail: { dataScope: d.dataScope, permissionCount: d.permissions?.length },
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: null,
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const result = deleteRole(code)
  if (!result.ok) return NextResponse.json({ error: result.reason ?? "删除失败" }, { status: 400 })

  writeAuditLog({
    actorId: user.sub, actorName: user.name, actorRole: user.role, actorBranch: user.branch,
    action: "admin.role.delete", resourceType: "role", resourceId: code,
    summary: `${user.name} 删除角色 ${code}`,
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: null,
  })
  return NextResponse.json({ ok: true })
}
