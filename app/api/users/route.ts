import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import { listUsers, createUser } from "@/lib/rbac/users"
import { roleExists } from "@/lib/rbac/roles"

export const runtime = "nodejs"

const createSchema = z.object({
  username: z.string().min(2).max(40).regex(/^[a-zA-Z0-9_.-]+$/, "用户名仅含字母数字_.-"),
  display_name: z.string().min(1).max(40),
  password: z.string().min(6).max(72),
  role: z.string().min(1).max(60),
  branch: z.string().max(60).nullable().optional(),
  grid: z.string().max(60).nullable().optional(),
  manager_id: z.string().max(60).nullable().optional(),
})

export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json({ users: listUsers() })
}

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!can(user.role, "manage_users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  const d = parsed.data
  if (!roleExists(d.role)) return NextResponse.json({ error: "角色不存在" }, { status: 400 })

  const result = createUser(d)
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 })

  writeAuditLog({
    actorId: user.sub, actorName: user.name, actorRole: user.role, actorBranch: user.branch,
    action: "admin.user.create", resourceType: "user", resourceId: result.id,
    summary: `${user.name} 新建账户「${d.display_name}」（${d.username}，角色 ${d.role}）`,
    detail: { username: d.username, role: d.role },
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: null,
  })
  return NextResponse.json({ id: result.id }, { status: 201 })
}
