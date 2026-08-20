/**
 * 数据字典 / schema 元数据能力。
 *
 * 目的：让 NL2SQL 不再依赖「5 张硬编码表」，而是把真实库表结构与字段注释
 * （表名 + 列名 + 类型 + 中文说明）注入 Agent 的 System Prompt，使模型能：
 *  1. 正确匹配「问题 → 相关库表」
 *  2. 正确引用真实字段名生成 SQL / Python
 *
 * 默认库 bank.db 的 5 张业务表带手写中文注释；外部 SQLite 文件（企业库/结算/担保）
 * 通过 PRAGMA 自动反射，字段无注释时仅列名 + 类型。
 */

import Database from "better-sqlite3"
import path from "path"

export type TableColumn = {
  name: string
  type: string
  notNull: boolean
  pk: boolean
  comment?: string
}

export type TableSchema = {
  name: string
  comment?: string
  columns: TableColumn[]
}

export type DbSchema = {
  /** 数据源标识：默认库为 "default"，外部为数据源 id */
  source: string
  tables: TableSchema[]
}

// ── 默认 bank.db 业务表（对外可查，不含用户/审计/渠道等系统表） ──────────────
export const CORE_TABLES = ["customers", "managers", "alerts", "visits", "products"]

const TABLE_COMMENTS: Record<string, string> = {
  customers: "客户主表",
  managers: "客户经理绩效",
  alerts: "业务预警",
  visits: "走访记录",
  products: "产品目录",
}

// ── 字段中文注释（默认 bank.db 五表；金额单位均为「元」） ─────────────────────
const COLUMN_COMMENTS: Record<string, Record<string, string>> = {
  customers: {
    id: "客户编号（如 C001）",
    name: "客户姓名",
    id_no_masked: "脱敏身份证号",
    phone_masked: "脱敏手机号",
    address: "地址",
    community: "所在小区/社区",
    grid: "网格",
    branch: "所属支行",
    manager_name: "客户经理姓名",
    avg_deposit: "日均存款（元）",
    mortgage_loan: "按揭贷款余额（元）",
    credit_loan: "信用贷款余额（元）",
    has_valid_contract: "是否有有效合同（0/1）",
    used_credit_amount: "已用信金额（元）",
    credit_report_updated_at: "征信更新时间",
    has_other_bank_loan: "他行是否有贷款（0/1）",
    risk_level: "风险等级 low/medium/high",
    segment: "客群分类 high_net_worth/stock/potential/new",
    last_visit_at: "最近走访时间",
    introduced_at: "引入时间",
    deposit_term: "存款期限",
    performance_owner: "绩效归属人",
  },
  managers: {
    id: "经理编号",
    name: "经理姓名",
    branch: "所属支行",
    grid: "网格",
    current_customer_count: "当前管户数",
    monthly_deposit_increase: "本月存款新增（元）",
    monthly_loan_increase: "本月贷款新增（元）",
    monthly_new_customers: "本月新增客户数",
    maintenance_score: "维护得分",
    vs_last_month_deposit: "存款环比（%）",
    vs_last_month_loan: "贷款环比（%）",
  },
  alerts: {
    id: "预警编号",
    type: "预警类型（deposit_due/loan_due/financing_growth/financing_surge/new_property/grid_change/branch_abnormal）",
    title: "标题",
    severity: "严重度 info/warning/critical",
    customer_id: "客户编号",
    customer_name: "客户姓名",
    manager_name: "客户经理",
    amount: "金额（元）",
    due_date: "到期日",
    description: "描述",
    suggested_action: "建议动作",
    created_at: "创建时间",
    status: "状态 pending/processing/done",
  },
  visits: {
    id: "记录编号",
    customer_id: "客户编号",
    visited_at: "走访时间",
    manager: "客户经理",
    channel: "渠道（电话/上门/网点/微信）",
    summary: "走访摘要",
  },
  products: {
    product_code: "产品代码",
    product_name: "产品名称",
    category: "类别",
    match_reason: "匹配理由",
    expected_rate: "预期利率",
    risk_hint: "风险提示",
  },
}

function columnComment(table: string, column: string): string | undefined {
  return COLUMN_COMMENTS[table]?.[column]
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/** 反射一个 SQLite 文件的表结构。tables 未传时反射全部非系统表。 */
export function introspectSqlite(dbPath: string, opts?: { tables?: string[] }): DbSchema {
  const abs = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath)
  const db = new Database(abs, { readonly: true, fileMustExist: true })
  try {
    let tableNames: string[]
    if (opts?.tables) {
      tableNames = opts.tables
    } else {
      tableNames = (
        db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
          .all() as { name: string }[]
      ).map((r) => r.name)
    }

    const tables: TableSchema[] = tableNames.map((name) => {
      const raw = db.prepare(`PRAGMA table_info(${quoteIdent(name)})`).all() as {
        name: string; type: string; notnull: number; pk: number
      }[]
      return {
        name,
        comment: TABLE_COMMENTS[name],
        columns: raw.map((c) => ({
          name: c.name,
          type: c.type || "TEXT",
          notNull: !!c.notnull,
          pk: !!c.pk,
          comment: columnComment(name, c.name),
        })),
      }
    })
    return { source: "default", tables }
  } finally {
    db.close()
  }
}

/** 默认库 bank.db 的业务表数据字典。 */
export function getDefaultSchema(): DbSchema {
  return introspectSqlite(path.join(process.cwd(), "data", "bank.db"), { tables: CORE_TABLES })
}

/**
 * 把数据字典渲染成可注入 System Prompt 的中文块。
 * focusTable 命中时把该表排在最前并标注「用户当前选中」。
 */
export function buildSchemaPrompt(schema: DbSchema | undefined, focusTable?: string | null): string {
  if (!schema || schema.tables.length === 0) return ""

  const ordered = focusTable
    ? [...schema.tables].sort((a, b) => (b.name === focusTable ? 1 : 0) - (a.name === focusTable ? 1 : 0))
    : schema.tables

  const lines: string[] = [
    "## 数据字典（当前数据源可查询的表与字段）",
    "金额字段单位均为「元」，显示时除以 10000 转为「万」。",
  ]

  for (const t of ordered) {
    const mark = t.name === focusTable ? " ★ 用户当前选中" : ""
    lines.push(`### 表 ${t.name}${t.comment ? `（${t.comment}）` : ""}${mark}`)
    for (const c of t.columns) {
      const desc = c.comment ? ` — ${c.comment}` : ""
      const key = c.pk ? " [主键]" : ""
      lines.push(`- ${c.name} ${c.type}${key}${desc}`)
    }
  }
  return lines.join("\n")
}
