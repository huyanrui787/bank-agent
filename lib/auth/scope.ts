import type { AccessTokenPayload } from "./jwt"
import { getRoleDataScope } from "./permissions"

/**
 * 结构化数据范围（替代原先硬编码字段名的 SQL WHERE 字符串）。
 * 这里只表达「逻辑字段 + 值」，真实列名的转译由数据源连接器（lib/datasource）负责，
 * 使数据范围下沉与具体库的列名解耦 —— 换真实库时无需改这里的字段名。
 */

/** 单字段等值过滤：customer/manager/alert 域的通用形态 */
export type ScopeEq = {
  kind: "eq"
  field: string // 业务逻辑字段名（managerName / branch / id）
  value: string
}

/** 支行维度的预警过滤：借 customer 表的 branch 字段间接过滤 alert */
export type ScopeAlertBranch = {
  kind: "customerBranch"
  branch: string
}

export type DataScope = {
  type: "personal" | "branch" | "bank"
  customer: ScopeEq | null
  manager: ScopeEq | null
  alert: ScopeEq | ScopeAlertBranch | null
  // Human-readable label for audit logs
  label: string
}

export function buildScope(user: Pick<AccessTokenPayload, "role" | "name" | "branch" | "managerId">): DataScope {
  // 数据范围类型由角色配置（roles.data_scope）决定，范围「值」取自用户自身字段。
  switch (getRoleDataScope(user.role)) {
    case "personal":
      return {
        type: "personal",
        customer: { kind: "eq", field: "managerName", value: user.name },
        manager: { kind: "eq", field: "id", value: user.managerId ?? "" },
        alert: { kind: "eq", field: "managerName", value: user.name },
        label: `本人（${user.name}）`,
      }
    case "branch":
      return {
        type: "branch",
        customer: { kind: "eq", field: "branch", value: user.branch ?? "" },
        manager: { kind: "eq", field: "branch", value: user.branch ?? "" },
        alert: { kind: "customerBranch", branch: user.branch ?? "" },
        label: `本支行（${user.branch}）`,
      }
    default:
      // bank — full access
      return {
        type: "bank",
        customer: null,
        manager: null,
        alert: null,
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
