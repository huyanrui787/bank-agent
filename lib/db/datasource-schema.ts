/**
 * 按数据源 id 解析 schema 元数据。
 * - sqlite：直接用 better-sqlite3 反射（Node 侧，零外部依赖，演示最稳）
 * - 其它（MySQL/PG/Oracle/…）：转发给 codeact sidecar 用 SQLAlchemy inspector 反射
 * - ES / 向量库 / DTSQL：暂不支持自动取表结构，返回空表 + 提示
 */

import { getDb } from "@/lib/db"
import { decryptSecret } from "@/lib/security/encrypt"
import { introspectSqlite, type DbSchema } from "@/lib/db/schema-info"

const CODEACT = "http://127.0.0.1:8765"

type DsRow = {
  id: string; name: string; type: string; host: string | null; port: number | null
  database_name: string | null; username: string | null; password_enc: string | null
  extra_config: string; enabled: number
}

export async function resolveDatasourceSchema(id: string): Promise<DbSchema | null> {
  const row = getDb().prepare(
    "SELECT * FROM data_sources WHERE id = ? AND enabled = 1"
  ).get(id) as DsRow | undefined
  if (!row) return null

  if (row.type === "sqlite") {
    const s = introspectSqlite(row.database_name ?? "data/bank.db")
    return { ...s, source: row.id }
  }

  const payload = {
    type: row.type,
    host: row.host,
    port: row.port,
    database_name: row.database_name,
    username: row.username,
    password: decryptSecret(row.password_enc),
    extra_config: JSON.parse(row.extra_config || "{}"),
  }

  try {
    const res = await fetch(`${CODEACT}/schema`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json() as { tables?: { name: string; comment?: string; columns: { name: string; type: string; notNull: boolean; pk: boolean }[] }[]; hint?: string }
    return {
      source: row.id,
      tables: (json.tables ?? []).map((t) => ({
        name: t.name,
        comment: t.comment,
        columns: t.columns ?? [],
      })),
    }
  } catch {
    return null
  }
}
