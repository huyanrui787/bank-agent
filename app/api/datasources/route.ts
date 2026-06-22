import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"

export const runtime = "nodejs"

export const DS_TYPE_LABELS: Record<string, string> = {
  sqlite:           "SQLite",
  mysql:            "MySQL",
  postgresql:       "PostgreSQL",
  sqlserver:        "SQL Server",
  oracle:           "Oracle",
  db2:              "DB2",
  hive:             "Hive",
  impala:           "Impala",
  elasticsearch:    "Elasticsearch",
  dtsql:            "DTSQL（自建）",
  vector_pgvector:  "向量数据库（pgvector）",
  vector_milvus:    "向量数据库（Milvus）",
}

type DsRow = {
  id: string; name: string; type: string; host: string | null; port: number | null
  database_name: string | null; username: string | null; password_enc: string | null
  extra_config: string; enabled: number; created_by: string | null; created_at: string
}

function maskRow(row: DsRow) {
  return {
    id: row.id, name: row.name, type: row.type,
    host: row.host, port: row.port, databaseName: row.database_name,
    username: row.username,
    hasPassword: !!row.password_enc,
    extraConfig: JSON.parse(row.extra_config || "{}"),
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  const rows = db.prepare("SELECT * FROM data_sources ORDER BY created_at DESC").all() as DsRow[]
  return NextResponse.json({ datasources: rows.map(maskRow) })
}

const createSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(["sqlite","mysql","postgresql","sqlserver","oracle","db2","hive","impala","elasticsearch","dtsql","vector_pgvector","vector_milvus"]),
  host: z.string().max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  databaseName: z.string().max(200).optional(),
  username: z.string().max(200).optional(),
  password: z.string().max(500).optional(),
  extraConfig: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "branch_admin") return NextResponse.json({ error: "仅分行管理员可配置数据源" }, { status: 403 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })

  const { name, type, host, port, databaseName, username, password, extraConfig } = parsed.data
  const id = crypto.randomUUID()
  const passwordEnc = password ? Buffer.from(password).toString("base64") : null

  const db = getDb()
  db.prepare(
    "INSERT INTO data_sources (id,name,type,host,port,database_name,username,password_enc,extra_config,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).run(id, name, type, host ?? null, port ?? null, databaseName ?? null, username ?? null, passwordEnc, JSON.stringify(extraConfig), user.sub)

  return NextResponse.json({ id }, { status: 201 })
}
