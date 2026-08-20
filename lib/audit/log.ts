import { createHash, randomUUID } from "crypto"
import { getDb } from "@/lib/db"

export type AuditAction =
  | "auth.login" | "auth.logout" | "auth.login_failed" | "auth.token_refresh"
  | "data.customer.list" | "data.customer.view" | "data.customer.search"
  | "data.alert.list" | "data.alert.view"
  | "data.export.customers" | "data.export.managers" | "data.export.alerts"
  | "ai.chat.query" | "ai.codeact.exec" | "ai.qa.query"
  | "alert.status.update" | "alert.notification.push"
  | "access.denied"
  | "admin.user.create" | "admin.user.update" | "admin.user.delete"
  | "admin.role.create" | "admin.role.update" | "admin.role.delete"
  | "admin.datasource.create" | "admin.datasource.update" | "admin.datasource.delete"

export type AuditEntry = {
  actorId: string
  actorName: string
  actorRole: string
  actorBranch?: string | null
  action: AuditAction
  resourceType: string
  resourceId?: string | null
  summary: string
  detail?: unknown
  ipAddress?: string | null
  requestId?: string | null
  dataScope?: string | null
  recordCount?: number | null
}

function hashEntry(id: string, actorId: string, action: string, resourceId: string, prevHash: string): string {
  return createHash("sha256")
    .update(`${id}|${actorId}|${action}|${resourceId}|${prevHash}`)
    .digest("hex")
}

export function writeAuditLog(entry: AuditEntry): void {
  try {
    const db = getDb()
    const id = randomUUID()

    const lastRow = db
      .prepare("SELECT entry_hash FROM audit_logs ORDER BY rowid DESC LIMIT 1")
      .get() as { entry_hash: string } | undefined
    const prevHash = lastRow?.entry_hash ?? ""

    const entryHash = hashEntry(
      id,
      entry.actorId,
      entry.action,
      entry.resourceId ?? "",
      prevHash,
    )

    db.prepare(`
      INSERT INTO audit_logs
        (id, prev_hash, entry_hash, actor_id, actor_name, actor_role, actor_branch,
         action, resource_type, resource_id, summary, detail,
         ip_address, request_id, data_scope, record_count)
      VALUES
        (@id, @prev_hash, @entry_hash, @actor_id, @actor_name, @actor_role, @actor_branch,
         @action, @resource_type, @resource_id, @summary, @detail,
         @ip_address, @request_id, @data_scope, @record_count)
    `).run({
      id,
      prev_hash: prevHash,
      entry_hash: entryHash,
      actor_id: entry.actorId,
      actor_name: entry.actorName,
      actor_role: entry.actorRole,
      actor_branch: entry.actorBranch ?? null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      summary: entry.summary.slice(0, 500),
      detail: entry.detail ? JSON.stringify(entry.detail).slice(0, 4000) : null,
      ip_address: entry.ipAddress ?? null,
      request_id: entry.requestId ?? null,
      data_scope: entry.dataScope ?? null,
      record_count: entry.recordCount ?? null,
    })
  } catch (err) {
    // Audit log failures must never crash the main request
    console.error("[audit] write failed:", err)
  }
}

export type AuditLogRow = {
  id: string
  prev_hash: string
  entry_hash: string
  actor_id: string
  actor_name: string
  actor_role: string
  actor_branch: string | null
  action: string
  resource_type: string
  resource_id: string | null
  summary: string
  detail: string | null
  ip_address: string | null
  request_id: string | null
  data_scope: string | null
  record_count: number | null
  created_at: string
}

export type AuditQueryParams = {
  actorId?: string
  action?: string
  resourceType?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export function queryAuditLogs(params: AuditQueryParams = {}): {
  rows: AuditLogRow[]
  total: number
} {
  const db = getDb()
  const { page = 1, pageSize = 50, actorId, action, resourceType, from, to } = params
  const conditions: string[] = ["1=1"]
  const bindings: unknown[] = []

  if (actorId) { conditions.push("actor_id = ?"); bindings.push(actorId) }
  if (action)  { conditions.push("action = ?");   bindings.push(action) }
  if (resourceType) { conditions.push("resource_type = ?"); bindings.push(resourceType) }
  if (from) { conditions.push("created_at >= ?"); bindings.push(from) }
  if (to)   { conditions.push("created_at <= ?"); bindings.push(to) }

  const where = conditions.join(" AND ")
  const offset = (page - 1) * pageSize

  const total = (db.prepare(`SELECT COUNT(*) as n FROM audit_logs WHERE ${where}`)
    .get(...bindings) as { n: number }).n

  const rows = db.prepare(
    `SELECT * FROM audit_logs WHERE ${where} ORDER BY rowid DESC LIMIT ? OFFSET ?`
  ).all(...bindings, pageSize, offset) as AuditLogRow[]

  return { rows, total }
}

/** Verify the hash chain integrity. Returns { valid: true } or { valid: false, brokenAt: id }. */
export function verifyChainIntegrity(): { valid: boolean; brokenAt?: string; checked: number } {
  const db = getDb()
  const rows = db.prepare(
    "SELECT id, prev_hash, entry_hash, actor_id, action, resource_id FROM audit_logs ORDER BY rowid ASC"
  ).all() as { id: string; prev_hash: string; entry_hash: string; actor_id: string; action: string; resource_id: string | null }[]

  let prevHash = ""
  for (const row of rows) {
    const expected = hashEntry(row.id, row.actor_id, row.action, row.resource_id ?? "", prevHash)
    if (expected !== row.entry_hash) {
      return { valid: false, brokenAt: row.id, checked: rows.indexOf(row) }
    }
    prevHash = row.entry_hash
  }
  return { valid: true, checked: rows.length }
}
