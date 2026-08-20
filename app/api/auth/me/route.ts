import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getRolePermissions } from "@/lib/auth/permissions"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const id = req.headers.get("x-user-id")
  const name = req.headers.get("x-user-name")
  const role = req.headers.get("x-user-role")
  const branch = req.headers.get("x-user-branch") || null
  const grid = req.headers.get("x-user-grid") || null
  const managerId = req.headers.get("x-user-manager-id") || null

  if (!id || !name || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const roleName = (getDb().prepare("SELECT name FROM roles WHERE code = ?").get(role) as { name: string } | undefined)?.name ?? null

  return NextResponse.json({
    id,
    name: decodeURIComponent(name),
    role,
    branch: branch ? decodeURIComponent(branch) || null : null,
    grid: grid ? decodeURIComponent(grid) || null : null,
    managerId,
    roleName,
    permissions: [...getRolePermissions(role)],
  })
}
