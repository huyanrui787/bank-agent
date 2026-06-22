import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { verifyRefreshToken } from "@/lib/auth/jwt"
import { writeAuditLog } from "@/lib/audit/log"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refresh_token")?.value
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()

  if (refreshToken) {
    const payload = await verifyRefreshToken(refreshToken)
    if (payload) {
      const db = getDb()
      db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?").run(payload.jti)

      const user = db.prepare("SELECT id, display_name, role, branch FROM users WHERE id = ?")
        .get(payload.sub) as { id: string; display_name: string; role: string; branch: string | null } | undefined

      if (user) {
        writeAuditLog({
          actorId: user.id,
          actorName: user.display_name,
          actorRole: user.role,
          actorBranch: user.branch,
          action: "auth.logout",
          resourceType: "auth",
          resourceId: user.id,
          summary: `${user.display_name} 退出登录`,
          ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",
          requestId,
        })
      }
    }
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set("access_token", "", { maxAge: 0, path: "/" })
  res.cookies.set("refresh_token", "", { maxAge: 0, path: "/api/auth/refresh" })
  return res
}
