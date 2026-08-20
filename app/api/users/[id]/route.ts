import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { getUser, updateUser, deleteUser } from "@/lib/rbac/users"
import { roleExists } from "@/lib/rbac/roles"

export const runtime = "nodejs"

const updateSchema = z.object({
  display_name: z.string().min(1).max(40).optional(),
  role: z.string().min(1).max(60).optional(),
  branch: z.string().max(60).nullable().optional(),
  grid: z.string().max(60).nullable().optional(),
  manager_id: z.string().max(60).nullable().optional(),
  enabled: z.boolean().optional(),
  password: z.string().min(6).max(72).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const u = getUser(id)
  if (!u) return NextResponse.json({ error: "不存在" }, { status: 404 })
  return NextResponse.json({ user: u })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  const d = parsed.data
  if (d.role !== undefined && !roleExists(d.role)) return NextResponse.json({ error: "角色不存在" }, { status: 400 })
  if (!updateUser(id, d)) return NextResponse.json({ error: "不存在" }, { status: 404 })

  writeAuditLog({
    actorId: user.sub, actorName: user.name, actorRole: user.role, actorBranch: user.branch,
    action: "admin.user.update", resourceType: "user", resourceId: id,
    summary: `${user.name} 更新账户 ${id}`,
    detail: { changedFields: Object.keys(d).filter((k) => k !== "password") },
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: null,
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (id === user.sub) return NextResponse.json({ error: "不能删除当前登录账户" }, { status: 400 })

  if (!deleteUser(id)) return NextResponse.json({ error: "不存在" }, { status: 404 })

  writeAuditLog({
    actorId: user.sub, actorName: user.name, actorRole: user.role, actorBranch: user.branch,
    action: "admin.user.delete", resourceType: "user", resourceId: id,
    summary: `${user.name} 删除账户 ${id}`,
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: null,
  })
  return NextResponse.json({ ok: true })
}
