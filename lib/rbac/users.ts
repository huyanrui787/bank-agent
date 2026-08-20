import { getDb } from "@/lib/db"
import bcrypt from "bcryptjs"

export type UserRecord = {
  id: string
  username: string
  display_name: string
  role: string
  role_name: string | null
  branch: string | null
  grid: string | null
  manager_id: string | null
  enabled: boolean
  last_login_at: string | null
  created_at: string
}

const SELECT = `
  SELECT u.id, u.username, u.display_name, u.role, r.name AS role_name,
         u.branch, u.grid, u.manager_id, u.enabled, u.last_login_at, u.created_at
  FROM users u LEFT JOIN roles r ON r.code = u.role
`

function toUser(row: Record<string, unknown>): UserRecord {
  return {
    id: row.id as string,
    username: row.username as string,
    display_name: row.display_name as string,
    role: row.role as string,
    role_name: (row.role_name as string | null) ?? null,
    branch: (row.branch as string | null) ?? null,
    grid: (row.grid as string | null) ?? null,
    manager_id: (row.manager_id as string | null) ?? null,
    enabled: Boolean(row.enabled),
    last_login_at: (row.last_login_at as string | null) ?? null,
    created_at: row.created_at as string,
  }
}

export function listUsers(): UserRecord[] {
  const rows = getDb().prepare(`${SELECT} ORDER BY u.created_at ASC`).all() as Record<string, unknown>[]
  return rows.map(toUser)
}

export function getUser(id: string): UserRecord | null {
  const row = getDb().prepare(`${SELECT} WHERE u.id = ?`).get(id) as Record<string, unknown> | undefined
  return row ? toUser(row) : null
}

export function createUser(input: {
  username: string
  display_name: string
  password: string
  role: string
  branch?: string | null
  grid?: string | null
  manager_id?: string | null
}): { id: string } | { error: string } {
  const db = getDb()
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(input.username)) {
    return { error: "用户名已存在" }
  }
  const id = crypto.randomUUID()
  const hash = bcrypt.hashSync(input.password, 12)
  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, branch, grid, manager_id, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, input.username, hash, input.display_name, input.role, input.branch ?? null, input.grid ?? null, input.manager_id ?? null)
  return { id }
}

export function updateUser(id: string, patch: {
  display_name?: string
  role?: string
  branch?: string | null
  grid?: string | null
  manager_id?: string | null
  enabled?: boolean
  password?: string
}): boolean {
  const db = getDb()
  if (!db.prepare("SELECT 1 FROM users WHERE id = ?").get(id)) return false

  const sets: string[] = ["updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"]
  const vals: unknown[] = []
  if (patch.display_name !== undefined) { sets.push("display_name = ?"); vals.push(patch.display_name) }
  if (patch.role !== undefined) { sets.push("role = ?"); vals.push(patch.role) }
  if (patch.branch !== undefined) { sets.push("branch = ?"); vals.push(patch.branch ?? null) }
  if (patch.grid !== undefined) { sets.push("grid = ?"); vals.push(patch.grid ?? null) }
  if (patch.manager_id !== undefined) { sets.push("manager_id = ?"); vals.push(patch.manager_id ?? null) }
  if (patch.enabled !== undefined) { sets.push("enabled = ?"); vals.push(patch.enabled ? 1 : 0) }
  if (patch.password !== undefined && patch.password !== "") {
    sets.push("password_hash = ?")
    vals.push(bcrypt.hashSync(patch.password, 12))
  }

  vals.push(id)
  const info = db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals)
  return info.changes > 0
}

export function deleteUser(id: string): boolean {
  const info = getDb().prepare("DELETE FROM users WHERE id = ?").run(id)
  return info.changes > 0
}
