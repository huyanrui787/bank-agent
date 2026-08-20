import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can, ACTIONS } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { listRoles, createRole } from "@/lib/rbac/roles"

export const runtime = "nodejs"

const createSchema = z.object({
  name: z.string().min(1).max(40),
  dataScope: z.enum(["personal", "branch", "bank"]),
  maskPii: z.boolean().optional(),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).max(50).optional(),
})

export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json({ roles: listRoles(), actions: ACTIONS })
}

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  const d = parsed.data
  const invalid = (d.permissions ?? []).filter((a) => !(a in ACTIONS))
  if (invalid.length) return NextResponse.json({ error: `未知权限：${invalid.join(", ")}` }, { status: 400 })

  const code = "role_" + crypto.randomUUID().slice(0, 8)
  const role = createRole({ code, name: d.name, dataScope: d.dataScope, maskPii: d.maskPii, description: d.description, permissions: d.permissions })

  writeAuditLog({
    actorId: user.sub, actorName: user.name, actorRole: user.role, actorBranch: user.branch,
    action: "admin.role.create", resourceType: "role", resourceId: code,
    summary: `${user.name} 新建角色「${d.name}」（${code}，范围 ${d.dataScope}）`,
    detail: { permissions: d.permissions ?? [] },
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: null,
  })
  return NextResponse.json({ role }, { status: 201 })
}
