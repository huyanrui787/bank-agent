/**
 * 功能权限查询：从 role_permissions 表读取（DB 驱动），角色缺失时回退内置默认。
 * 目录（ACTIONS / 内置角色-权限映射 / 数据范围缺省）见 lib/rbac/catalog.ts。
 */
import { getDb } from "@/lib/db"
import {
  ACTIONS,
  BUILTIN_PERMISSIONS,
  DEFAULT_DATA_SCOPE,
  type Action,
  type DataScopeType,
} from "@/lib/rbac/catalog"

export { ACTIONS, type Action, type DataScopeType }

export function getRolePermissions(role: string): Set<string> {
  const rows = getDb()
    .prepare("SELECT action FROM role_permissions WHERE role_code = ?")
    .all(role) as { action: string }[]
  if (rows.length > 0) return new Set(rows.map((r) => r.action))
  // roles/role_permissions 尚未种子时回退内置默认
  return new Set(BUILTIN_PERMISSIONS[role] ?? [])
}

export function can(role: string, action: Action): boolean {
  return getRolePermissions(role).has(action)
}

/** 读角色数据范围（roles.data_scope），缺失回退内置缺省；未知角色默认 bank。 */
export function getRoleDataScope(role: string): DataScopeType {
  const row = getDb()
    .prepare("SELECT data_scope FROM roles WHERE code = ?")
    .get(role) as { data_scope: string } | undefined
  if (row && (row.data_scope === "personal" || row.data_scope === "branch" || row.data_scope === "bank")) {
    return row.data_scope as DataScopeType
  }
  return DEFAULT_DATA_SCOPE[role] ?? "bank"
}
