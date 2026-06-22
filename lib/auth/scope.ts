import type { AccessTokenPayload } from "./jwt"

export type DataScope = {
  type: "personal" | "branch" | "bank"
  // SQL WHERE fragments (appended with AND to existing queries)
  customerWhere: string
  customerParams: unknown[]
  alertWhere: string
  alertParams: unknown[]
  managerWhere: string
  managerParams: unknown[]
  // Human-readable label for audit logs
  label: string
}

export function buildScope(user: Pick<AccessTokenPayload, "role" | "name" | "branch" | "managerId">): DataScope {
  switch (user.role) {
    case "manager":
      return {
        type: "personal",
        customerWhere: "manager_name = ?",
        customerParams: [user.name],
        alertWhere: "manager_name = ?",
        alertParams: [user.name],
        managerWhere: "id = ?",
        managerParams: [user.managerId ?? ""],
        label: `本人（${user.name}）`,
      }
    case "sub_branch_head":
      return {
        type: "branch",
        customerWhere: "branch = ?",
        customerParams: [user.branch ?? ""],
        alertWhere: `customer_id IN (SELECT id FROM customers WHERE branch = ?)`,
        alertParams: [user.branch ?? ""],
        managerWhere: "branch = ?",
        managerParams: [user.branch ?? ""],
        label: `本支行（${user.branch}）`,
      }
    default:
      // branch_admin, compliance, readonly — full access
      return {
        type: "bank",
        customerWhere: "1=1",
        customerParams: [],
        alertWhere: "1=1",
        alertParams: [],
        managerWhere: "1=1",
        managerParams: [],
        label: "全行",
      }
  }
}

/** Build a scope object from middleware-injected request headers. */
export function scopeFromHeaders(headers: Headers): DataScope | null {
  const role = headers.get("x-user-role") as AccessTokenPayload["role"] | null
  const rawName = headers.get("x-user-name")
  const rawBranch = headers.get("x-user-branch")
  const managerId = headers.get("x-user-manager-id")

  if (!role || !rawName) return null
  const name = decodeURIComponent(rawName)
  const branch = rawBranch ? decodeURIComponent(rawBranch) || null : null
  return buildScope({ role, name, branch, managerId: managerId || null })
}

/** Extract the user context object from middleware-injected headers. */
export function userFromHeaders(headers: Headers): AccessTokenPayload | null {
  const id = headers.get("x-user-id")
  const rawName = headers.get("x-user-name")
  const role = headers.get("x-user-role") as AccessTokenPayload["role"] | null

  if (!id || !rawName || !role) return null
  const rawBranch = headers.get("x-user-branch")
  const rawGrid = headers.get("x-user-grid")
  return {
    sub: id,
    name: decodeURIComponent(rawName),
    role,
    branch: rawBranch ? decodeURIComponent(rawBranch) || null : null,
    grid: rawGrid ? decodeURIComponent(rawGrid) || null : null,
    managerId: headers.get("x-user-manager-id"),
    orgId: "xian_branch",
    jti: "",
  }
}
