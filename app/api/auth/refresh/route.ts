import { NextRequest, NextResponse } from "next/server"
import { getDb, type DbUser } from "@/lib/db"
import { verifyRefreshToken, signAccessToken } from "@/lib/auth/jwt"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refresh_token")?.value
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 })
  }

  const payload = await verifyRefreshToken(refreshToken)
  if (!payload) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 })
  }

  const db = getDb()
  const tokenRow = db
    .prepare("SELECT * FROM refresh_tokens WHERE id = ? AND revoked = 0")
    .get(payload.jti) as { id: string; user_id: string; expires_at: string } | undefined

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Refresh token expired or revoked" }, { status: 401 })
  }

  const user = db
    .prepare("SELECT * FROM users WHERE id = ? AND enabled = 1")
    .get(payload.sub) as DbUser | undefined

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 })
  }

  const newAccessToken = await signAccessToken({
    sub: user.id,
    name: user.display_name,
    role: user.role,
    branch: user.branch,
    grid: user.grid,
    managerId: user.manager_id,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set("access_token", newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 900,
    path: "/",
  })
  return res
}
