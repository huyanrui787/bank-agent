import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"
import { decryptSecret } from "@/lib/security/encrypt"

export const runtime = "nodejs"

type DsRow = { id: string; type: string; host: string | null; port: number | null; database_name: string | null; username: string | null; password_enc: string | null; extra_config: string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "branch_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const row = db.prepare("SELECT * FROM data_sources WHERE id = ?").get(id) as DsRow | undefined
  if (!row) return NextResponse.json({ error: "数据源不存在" }, { status: 404 })

  const extra = JSON.parse(row.extra_config || "{}") as Record<string, unknown>
  const password = decryptSecret(row.password_enc)

  const payload = {
    type: row.type,
    host: row.host,
    port: row.port,
    database_name: row.database_name,
    username: row.username,
    password,
    extra_config: extra,
  }

  try {
    const start = Date.now()
    const res = await fetch("http://127.0.0.1:8765/datasource/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    })
    const latencyMs = Date.now() - start
    const data = await res.json() as { ok: boolean; message: string }
    return NextResponse.json({ ok: data.ok, message: data.message, latencyMs })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, message: `无法连接测试服务：${msg}`, latencyMs: 0 })
  }
}
