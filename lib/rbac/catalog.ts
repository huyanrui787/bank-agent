/**
 * RBAC 权限目录（单一来源）：功能权限动作、内置角色、内置角色-权限映射、角色数据范围。
 * 不依赖 DB —— 供 lib/db（种子）与 lib/auth（查询回退）共用，避免循环依赖。
 */

export const ACTIONS = {
  view_customer:            { label: "查看客户",       group: "数据查看" },
  view_alert:               { label: "查看预警",       group: "数据查看" },
  view_manager_performance: { label: "查看经理绩效",   group: "数据查看" },
  update_alert_status:      { label: "更新预警状态",   group: "业务操作" },
  ai_chat:                  { label: "AI 问答",        group: "业务操作" },
  export:                   { label: "导出数据",       group: "业务操作" },
  view_audit:               { label: "查看审计日志",   group: "系统管理" },
  manage_users:             { label: "账户与角色管理", group: "系统管理" },
  manage_datasources:       { label: "数据源配置",     group: "系统管理" },
  manage_channels:          { label: "渠道配置",       group: "系统管理" },
  manage_workflows:         { label: "工作流编排",     group: "系统管理" },
  manage_skills:            { label: "技能配置",       group: "系统管理" },
  manage_knowledge:         { label: "知识库管理",     group: "系统管理" },
} as const

export type Action = keyof typeof ACTIONS
export type DataScopeType = "personal" | "branch" | "bank"

export type BuiltinRole = {
  code: string
  name: string
  dataScope: DataScopeType
  maskPii: boolean
  description: string
}

export const BUILTIN_ROLES: BuiltinRole[] = [
  { code: "manager",          name: "客户经理",   dataScope: "personal", maskPii: false, description: "本人名下客户数据" },
  { code: "sub_branch_head",  name: "支行负责人", dataScope: "branch",   maskPii: false, description: "本支行数据" },
  { code: "branch_admin",     name: "分行管理员", dataScope: "bank",     maskPii: false, description: "全行数据与系统配置" },
  { code: "compliance",       name: "合规审计",   dataScope: "bank",     maskPii: true,  description: "全行数据（脱敏）与审计" },
  { code: "readonly",         name: "只读用户",   dataScope: "bank",     maskPii: true,  description: "全行数据（脱敏），只读" },
]

const MANAGER_ACTIONS: Action[] = [
  "view_customer", "update_alert_status", "ai_chat", "export", "view_alert", "view_manager_performance",
]

export const BUILTIN_PERMISSIONS: Record<string, Action[]> = {
  manager: MANAGER_ACTIONS,
  sub_branch_head: MANAGER_ACTIONS,
  branch_admin: [...MANAGER_ACTIONS, "view_audit", "manage_users", "manage_datasources", "manage_channels", "manage_workflows", "manage_skills", "manage_knowledge"],
  compliance: ["view_customer", "view_alert", "view_manager_performance", "view_audit", "ai_chat"],
  readonly: ["view_customer", "view_alert", "view_manager_performance", "ai_chat"],
}

/** 角色数据范围缺省（roles 表缺行时回退；未列出的角色默认 bank） */
export const DEFAULT_DATA_SCOPE: Record<string, DataScopeType> = {
  manager: "personal",
  sub_branch_head: "branch",
}
