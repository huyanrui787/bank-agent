import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { getDb, type DbUser } from "@/lib/db"
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt"
import { writeAuditLog } from "@/lib/audit/log"

export const runtime = "nodejs"

const schema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
})

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }

  const { username, password } = parsed.data
  const ip = getIp(req)
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()

  const db = getDb()
  const user = db
    .prepare("SELECT * FROM users WHERE username = ? AND enabled = 1")
    .get(username) as DbUser | undefined

  // Constant-time failure — don't reveal whether user exists
  const dummyHash = "$2b$12$p.W/FmtfpLbKGGr3XPQF9ei4wMxCgkQ6z.LyoHyr6C7NgXYZWt44S"
  const valid = user
    ? await bcrypt.compare(password, user.password_hash)
    : (await bcrypt.compare(password, dummyHash), false)

  if (!user || !valid) {
    writeAuditLog({
      actorId: user?.id ?? "unknown",
      actorName: username,
      actorRole: user?.role ?? "unknown",
      action: "auth.login_failed",
      resourceType: "auth",
      summary: `登录失败：${username}`,
      ipAddress: ip,
      requestId,
    })
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 })
  }

  // Issue tokens
  const accessToken = await signAccessToken({
    sub: user.id,
    name: user.display_name,
    role: user.role,
    branch: user.branch,
    grid: user.grid,
    managerId: user.manager_id,
  })
  const { token: refreshToken, jti } = await signRefreshToken(user.id)

  // Persist refresh token
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  db.prepare(
    "INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(jti, user.id, expiresAt)

  // Update last_login_at
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
    .run(new Date().toISOString(), user.id)

  writeAuditLog({
    actorId: user.id,
    actorName: user.display_name,
    actorRole: user.role,
    actorBranch: user.branch,
    action: "auth.login",
    resourceType: "auth",
    resourceId: user.id,
    summary: `${user.display_name}（${user.role}）登录成功`,
    ipAddress: ip,
    requestId,
  })

  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.display_name,
      role: user.role,
      branch: user.branch,
      grid: user.grid,
      managerId: user.manager_id,
    },
  })

  res.cookies.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 900,
    path: "/",
  })
  res.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 3600,
    path: "/api/auth/refresh",
  })

  return res
}
