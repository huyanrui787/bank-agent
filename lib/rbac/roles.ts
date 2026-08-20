import { getDb } from "@/lib/db"
import type { DataScopeType } from "./catalog"

export type RoleRecord = {
  code: string
  name: string
  data_scope: DataScopeType
  builtin: boolean
  mask_pii: boolean
  description: string
  created_at: string
  updated_at: string
}

export type RoleWithPermissions = RoleRecord & { permissions: string[] }

function toRole(row: Record<string, unknown>): RoleRecord {
  return {
    code: row.code as string,
    name: row.name as string,
    data_scope: row.data_scope as DataScopeType,
    builtin: Boolean(row.builtin),
    mask_pii: Boolean(row.mask_pii),
    description: (row.description as string) ?? "",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export function listRoles(): RoleWithPermissions[] {
  const db = getDb()
  const roles = db.prepare("SELECT * FROM roles ORDER BY builtin DESC, created_at ASC").all() as Record<string, unknown>[]
  const permRows = db.prepare("SELECT role_code, action FROM role_permissions").all() as { role_code: string; action: string }[]
  const byRole = new Map<string, string[]>()
  for (const p of permRows) {
    const list = byRole.get(p.role_code) ?? []
    list.push(p.action)
    byRole.set(p.role_code, list)
  }
  return roles.map((r) => ({ ...toRole(r), permissions: byRole.get(r.code as string) ?? [] }))
}

export function getRole(code: string): RoleWithPermissions | null {
  return listRoles().find((r) => r.code === code) ?? null
}

export function roleExists(code: string): boolean {
  return !!getDb().prepare("SELECT 1 FROM roles WHERE code = ?").get(code)
}

export function createRole(input: {
  code: string
  name: string
  dataScope: DataScopeType
  maskPii?: boolean
  description?: string
  permissions?: string[]
}): RoleWithPermissions {
  const db = getDb()
  db.transaction(() => {
    db.prepare("INSERT INTO roles (code, name, data_scope, builtin, mask_pii, description) VALUES (?, ?, ?, 0, ?, ?)")
      .run(input.code, input.name, input.dataScope, input.maskPii ? 1 : 0, input.description ?? "")
    const ins = db.prepare("INSERT INTO role_permissions (role_code, action) VALUES (?, ?)")
    for (const action of input.permissions ?? []) ins.run(input.code, action)
  })()
  return getRole(input.code)!
}

export function updateRole(code: string, input: {
  name?: string
  dataScope?: DataScopeType
  maskPii?: boolean
  description?: string
  permissions?: string[]
}): boolean {
  const db = getDb()
  if (!db.prepare("SELECT 1 FROM roles WHERE code = ?").get(code)) return false

  const sets: string[] = ["updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"]
  const vals: unknown[] = []
  if (input.name !== undefined) { sets.push("name = ?"); vals.push(input.name) }
  if (input.dataScope !== undefined) { sets.push("data_scope = ?"); vals.push(input.dataScope) }
  if (input.maskPii !== undefined) { sets.push("mask_pii = ?"); vals.push(input.maskPii ? 1 : 0) }
  if (input.description !== undefined) { sets.push("description = ?"); vals.push(input.description) }

  db.transaction(() => {
    vals.push(code)
    db.prepare(`UPDATE roles SET ${sets.join(", ")} WHERE code = ?`).run(...vals)
    if (input.permissions !== undefined) {
      db.prepare("DELETE FROM role_permissions WHERE role_code = ?").run(code)
      const ins = db.prepare("INSERT INTO role_permissions (role_code, action) VALUES (?, ?)")
      for (const action of input.permissions) ins.run(code, action)
    }
  })()
  return true
}

export function deleteRole(code: string): { ok: boolean; reason?: string } {
  const db = getDb()
  const row = db.prepare("SELECT builtin FROM roles WHERE code = ?").get(code) as { builtin: number } | undefined
  if (!row) return { ok: false, reason: "角色不存在" }
  if (row.builtin) return { ok: false, reason: "内置角色不可删除" }
  const used = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = ?").get(code) as { n: number }
  if (used.n > 0) return { ok: false, reason: `仍有 ${used.n} 个账户使用该角色，请先调整账户角色` }
  db.prepare("DELETE FROM roles WHERE code = ?").run(code)
  return { ok: true }
}
