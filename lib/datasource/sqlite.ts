/**
 * SqliteConnector：用 better-sqlite3 查询业务库，字段经映射转译。
 * 返回行的 key 统一为「业务逻辑字段」（camelCase），与真实库列名解耦。
 * 复用 lib/auth/desensitize 的合规脱敏逻辑。
 */
import type Database from "better-sqlite3"
import { desensitizeCustomer } from "@/lib/auth/desensitize"
import type { DataScope } from "@/lib/auth/scope"
import type {
  Customer,
  Manager,
  BusinessAlert,
  VisitRecord,
  ProductRecommendation,
} from "@/lib/mock/types"
import type { BusinessDataSource, CustomerFilter, AlertFilter } from "./types"
import type { BusinessMapping } from "./mapping"

function quote(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`
}

/** SELECT 列表：`"真实列名" AS 逻辑字段名`，使返回行 key 为逻辑字段名 */
function selectList(m: { table: string; columns: Record<string, string> }): string {
  return Object.entries(m.columns)
    .map(([logic, real]) => `${quote(real)} AS ${logic}`)
    .join(", ")
}

/** 把结构化 scope 转成 WHERE 片段 + 参数（字段名经映射转成真实列名） */
export function buildScopeWhere(
  domain: "customer" | "manager" | "alert",
  scope: DataScope,
  mapping: BusinessMapping,
): { where: string; params: unknown[] } {
  const cond = domain === "customer" ? scope.customer : domain === "manager" ? scope.manager : scope.alert
  if (!cond) return { where: "1=1", params: [] }

  if (cond.kind === "eq") {
    const col = mapping[domain].columns[cond.field]
    if (!col) return { where: "1=1", params: [] } // 映射缺失时放宽（等价全量）
    return { where: `${quote(col)} = ?`, params: [cond.value] }
  }

  // alert 域的 customerBranch：借 customer 表的 branch 字段间接过滤 alert
  const ct = mapping.customer.table
  const idCol = mapping.customer.columns.id ?? "id"
  const branchCol = mapping.customer.columns.branch ?? "branch"
  const alertCustomerCol = mapping.alert.columns.customerId ?? "customer_id"
  return {
    where: `${quote(alertCustomerCol)} IN (SELECT ${quote(idCol)} FROM ${quote(ct)} WHERE ${quote(branchCol)} = ?)`,
    params: [cond.branch],
  }
}

// ── 行转换（按逻辑字段名取值）───────────────────────────────────────────────

function toBool(v: unknown): boolean {
  return v === 1 || v === true || v === "1" || v === "true"
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function optStr(v: unknown): string | undefined {
  return v == null || v === "" ? undefined : String(v)
}

function reqStr(v: unknown): string {
  return v == null ? "" : String(v)
}

function toCustomer(row: Record<string, unknown>, role?: string): Customer {
  const c: Customer = {
    id: reqStr(row.id),
    name: reqStr(row.name),
    idNoMasked: reqStr(row.idNoMasked),
    phoneMasked: reqStr(row.phoneMasked),
    address: reqStr(row.address),
    community: reqStr(row.community),
    grid: reqStr(row.grid),
    branch: reqStr(row.branch),
    managerName: reqStr(row.managerName),
    avgDeposit: toNum(row.avgDeposit),
    mortgageLoan: toNum(row.mortgageLoan),
    creditLoan: toNum(row.creditLoan),
    hasValidContract: toBool(row.hasValidContract),
    usedCreditAmount: toNum(row.usedCreditAmount),
    creditReportUpdatedAt: optStr(row.creditReportUpdatedAt),
    hasOtherBankLoan: toBool(row.hasOtherBankLoan),
    riskLevel: (row.riskLevel as Customer["riskLevel"]) ?? "low",
    segment: (row.segment as Customer["segment"]) ?? "new",
    lastVisitAt: optStr(row.lastVisitAt),
    introducedAt: optStr(row.introducedAt),
    depositTerm: optStr(row.depositTerm) as Customer["depositTerm"],
    performanceOwner: optStr(row.performanceOwner),
  }
  if (role === "compliance" || role === "readonly") {
    return desensitizeCustomer(c, role)
  }
  return c
}

function toManager(row: Record<string, unknown>): Manager {
  return {
    id: reqStr(row.id),
    name: reqStr(row.name),
    branch: reqStr(row.branch),
    grid: reqStr(row.grid),
    currentCustomerCount: toNum(row.currentCustomerCount),
    monthlyDepositIncrease: toNum(row.monthlyDepositIncrease),
    monthlyLoanIncrease: toNum(row.monthlyLoanIncrease),
    monthlyNewCustomers: toNum(row.monthlyNewCustomers),
    maintenanceScore: toNum(row.maintenanceScore),
    vsLastMonthDeposit: toNum(row.vsLastMonthDeposit),
    vsLastMonthLoan: toNum(row.vsLastMonthLoan),
  }
}

function toAlert(row: Record<string, unknown>): BusinessAlert {
  return {
    id: reqStr(row.id),
    type: reqStr(row.type) as BusinessAlert["type"],
    title: reqStr(row.title),
    severity: (row.severity as BusinessAlert["severity"]) ?? "info",
    customerId: optStr(row.customerId),
    customerName: optStr(row.customerName),
    managerName: optStr(row.managerName),
    amount: optStr(row.amount) ? toNum(row.amount) : undefined,
    dueDate: optStr(row.dueDate),
    description: reqStr(row.description),
    suggestedAction: reqStr(row.suggestedAction),
    createdAt: reqStr(row.createdAt),
    status: (row.status as BusinessAlert["status"]) ?? "pending",
  }
}

function toVisit(row: Record<string, unknown>): VisitRecord {
  return {
    id: reqStr(row.id),
    customerId: reqStr(row.customerId),
    visitedAt: reqStr(row.visitedAt),
    manager: reqStr(row.manager),
    channel: (row.channel as VisitRecord["channel"]) ?? "电话",
    summary: reqStr(row.summary),
  }
}

function toProduct(row: Record<string, unknown>): ProductRecommendation {
  return {
    productCode: reqStr(row.productCode),
    productName: reqStr(row.productName),
    category: (row.category as ProductRecommendation["category"]) ?? "存款",
    matchReason: reqStr(row.matchReason),
    expectedRate: reqStr(row.expectedRate),
    riskHint: optStr(row.riskHint),
  }
}

export class SqliteConnector implements BusinessDataSource {
  constructor(
    private db: Database.Database,
    private mapping: BusinessMapping,
  ) {}

  filterCustomers(f: CustomerFilter, scope: DataScope, role?: string, limit = 30): Customer[] {
    const m = this.mapping.customer
    const conds: string[] = []
    const params: unknown[] = []

    const { where, params: sp } = buildScopeWhere("customer", scope, this.mapping)
    conds.push(where)
    params.push(...sp)

    if (f.community) {
      const c = m.columns.community ?? "community"
      const g = m.columns.grid ?? "grid"
      conds.push(`(${quote(c)} LIKE ? OR ${quote(g)} LIKE ?)`)
      params.push(`%${f.community}%`, `%${f.community}%`)
    }
    if (typeof f.minAvgDeposit === "number") {
      const c = m.columns.avgDeposit ?? "avg_deposit"
      conds.push(`${quote(c)} >= ?`)
      params.push(f.minAvgDeposit)
    }
    if (f.hasOtherBankLoan) {
      const h = m.columns.hasOtherBankLoan ?? "has_other_bank_loan"
      const ml = m.columns.mortgageLoan ?? "mortgage_loan"
      const cl = m.columns.creditLoan ?? "credit_loan"
      conds.push(`${quote(h)} = 1 AND ${quote(ml)} = 0 AND ${quote(cl)} = 0`)
    }
    if (f.hasValidContract) {
      const c = m.columns.hasValidContract ?? "has_valid_contract"
      conds.push(`${quote(c)} = 1`)
    }
    if (f.unusedCredit) {
      const c = m.columns.usedCreditAmount ?? "used_credit_amount"
      conds.push(`${quote(c)} = 0`)
    }

    const sql = `SELECT ${selectList(m)} FROM ${quote(m.table)} WHERE ${conds.join(" AND ")} LIMIT ${limit}`
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map((r) => toCustomer(r, role))
  }

  getManagers(scope: DataScope): Manager[] {
    const m = this.mapping.manager
    const { where, params } = buildScopeWhere("manager", scope, this.mapping)
    const orderCol = m.columns.monthlyDepositIncrease ?? "monthly_deposit_increase"
    const sql = `SELECT ${selectList(m)} FROM ${quote(m.table)} WHERE ${where} ORDER BY ${quote(orderCol)} DESC`
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map(toManager)
  }

  scanAlerts(f: AlertFilter, scope: DataScope, limit = 50): BusinessAlert[] {
    const m = this.mapping.alert
    const conds: string[] = []
    const params: unknown[] = []

    const { where, params: sp } = buildScopeWhere("alert", scope, this.mapping)
    conds.push(where)
    params.push(...sp)

    if (f.severity) {
      conds.push(`${quote(m.columns.severity ?? "severity")} = ?`)
      params.push(f.severity)
    }
    if (Array.isArray(f.types) && f.types.length > 0) {
      conds.push(`${quote(m.columns.type ?? "type")} IN (${f.types.map(() => "?").join(",")})`)
      params.push(...f.types)
    }
    if (f.status) {
      conds.push(`${quote(m.columns.status ?? "status")} = ?`)
      params.push(f.status)
    }

    const sev = quote(m.columns.severity ?? "severity")
    const sql = `SELECT ${selectList(m)} FROM ${quote(m.table)} WHERE ${conds.join(" AND ")} ORDER BY CASE ${sev} WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END LIMIT ${limit}`
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[]
    return rows.map(toAlert)
  }

  getCustomer(query: string, scope: DataScope, role?: string): Customer | undefined {
    const m = this.mapping.customer
    const { where, params } = buildScopeWhere("customer", scope, this.mapping)
    const name = quote(m.columns.name ?? "name")
    const id = quote(m.columns.id ?? "id")
    const idNo = quote(m.columns.idNoMasked ?? "id_no_masked")
    const phone = quote(m.columns.phoneMasked ?? "phone_masked")
    const comm = quote(m.columns.community ?? "community")
    const q = query.trim()
    const sql = `SELECT ${selectList(m)} FROM ${quote(m.table)} WHERE ${where} AND (${name} = ? OR ${id} = ? OR ${idNo} LIKE ? OR ${phone} LIKE ? OR ${comm} LIKE ?) LIMIT 1`
    const row = this.db
      .prepare(sql)
      .get(...params, q, q.toUpperCase(), `%${q}%`, `%${q}%`, `%${q}%`) as Record<string, unknown> | undefined
    return row ? toCustomer(row, role) : undefined
  }

  getAlert(id: string, scope: DataScope): BusinessAlert | undefined {
    const m = this.mapping.alert
    const { where, params } = buildScopeWhere("alert", scope, this.mapping)
    const sql = `SELECT ${selectList(m)} FROM ${quote(m.table)} WHERE ${quote(m.columns.id ?? "id")} = ? AND ${where}`
    const row = this.db.prepare(sql).get(id, ...params) as Record<string, unknown> | undefined
    return row ? toAlert(row) : undefined
  }

  getVisits(customerId?: string): VisitRecord[] {
    const m = this.mapping.visit
    const cid = quote(m.columns.customerId ?? "customer_id")
    const orderCol = quote(m.columns.visitedAt ?? "visited_at")
    const sql = customerId
      ? `SELECT ${selectList(m)} FROM ${quote(m.table)} WHERE ${cid} = ? ORDER BY ${orderCol} DESC`
      : `SELECT ${selectList(m)} FROM ${quote(m.table)} ORDER BY ${orderCol} DESC`
    const rows = (customerId
      ? this.db.prepare(sql).all(customerId)
      : this.db.prepare(sql).all()) as Record<string, unknown>[]
    return rows.map(toVisit)
  }

  getProducts(): ProductRecommendation[] {
    const m = this.mapping.product
    const sql = `SELECT ${selectList(m)} FROM ${quote(m.table)}`
    const rows = this.db.prepare(sql).all() as Record<string, unknown>[]
    return rows.map(toProduct)
  }
}
