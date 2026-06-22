import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const id = req.headers.get("x-user-id")
  const name = req.headers.get("x-user-name")
  const role = req.headers.get("x-user-role")
  const branch = req.headers.get("x-user-branch") || null
  const grid = req.headers.get("x-user-grid") || null
  const managerId = req.headers.get("x-user-manager-id") || null

  if (!id || !name || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    id,
    name: decodeURIComponent(name),
    role,
    branch: branch ? decodeURIComponent(branch) || null : null,
    grid: grid ? decodeURIComponent(grid) || null : null,
    managerId,
  })
}
