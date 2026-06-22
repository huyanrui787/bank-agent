import type { AccessTokenPayload } from "./jwt"

export type Action =
  | "view_customer"
  | "export"
  | "view_audit"
  | "manage_users"
  | "update_alert_status"
  | "ai_chat"
  | "view_alert"
  | "view_manager_performance"

type Role = AccessTokenPayload["role"]

const PERMISSION_MATRIX: Record<Role, Action[]> = {
  manager: [
    "view_customer", "update_alert_status", "ai_chat", "export",
    "view_alert", "view_manager_performance",
  ],
  sub_branch_head: [
    "view_customer", "update_alert_status", "ai_chat", "export",
    "view_alert", "view_manager_performance",
  ],
  branch_admin: [
    "view_customer", "update_alert_status", "ai_chat", "export",
    "view_alert", "view_manager_performance", "view_audit", "manage_users",
  ],
  compliance: [
    "view_customer", "view_alert", "view_manager_performance", "view_audit", "ai_chat",
  ],
  readonly: [
    "view_customer", "view_alert", "view_manager_performance", "ai_chat",
  ],
}

export function can(role: Role, action: Action): boolean {
  return PERMISSION_MATRIX[role]?.includes(action) ?? false
}

export function requirePermission(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw new Error(`Role '${role}' is not permitted to perform '${action}'`)
  }
}
