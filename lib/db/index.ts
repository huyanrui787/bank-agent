import Database from "better-sqlite3"
import path from "path"
import { CREATE_TABLES } from "./schema"
import { customers } from "@/lib/mock/customers"
import { managers } from "@/lib/mock/managers"
import { alerts } from "@/lib/mock/alerts"
import { visits } from "@/lib/mock/visits"
import { depositProducts, loanProducts } from "@/lib/mock/products"
import { desensitizeCustomer } from "@/lib/auth/desensitize"

const DB_PATH = path.join(process.cwd(), "data", "bank.db")

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma("journal_mode = WAL")
  _db.pragma("foreign_keys = ON")
  _db.exec(CREATE_TABLES)
  seedIfEmpty(_db)
  seedUsers(_db)
  return _db
}

function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as n FROM customers").get() as { n: number }).n
  if (count > 0) return

  const insertCustomer = db.prepare(`
    INSERT OR IGNORE INTO customers
    (id, name, id_no_masked, phone_masked, address, community, grid, branch, manager_name,
     avg_deposit, mortgage_loan, credit_loan, has_valid_contract, used_credit_amount,
     credit_report_updated_at, has_other_bank_loan, risk_level, segment,
     last_visit_at, introduced_at, deposit_term, performance_owner)
    VALUES
    (@id, @name, @idNoMasked, @phoneMasked, @address, @community, @grid, @branch, @managerName,
     @avgDeposit, @mortgageLoan, @creditLoan, @hasValidContract, @usedCreditAmount,
     @creditReportUpdatedAt, @hasOtherBankLoan, @riskLevel, @segment,
     @lastVisitAt, @introducedAt, @depositTerm, @performanceOwner)
  `)

  const insertMany = db.transaction((rows: typeof customers) => {
    for (const c of rows) {
      insertCustomer.run({
        ...c,
        hasValidContract: c.hasValidContract ? 1 : 0,
        hasOtherBankLoan: c.hasOtherBankLoan ? 1 : 0,
        creditReportUpdatedAt: c.creditReportUpdatedAt ?? null,
        lastVisitAt: c.lastVisitAt ?? null,
        introducedAt: c.introducedAt ?? null,
        depositTerm: c.depositTerm ?? null,
        performanceOwner: c.performanceOwner ?? null,
      })
    }
  })
  insertMany(customers)

  const insertManager = db.prepare(`
    INSERT OR IGNORE INTO managers
    (id, name, branch, grid, current_customer_count, monthly_deposit_increase,
     monthly_loan_increase, monthly_new_customers, maintenance_score,
     vs_last_month_deposit, vs_last_month_loan)
    VALUES
    (@id, @name, @branch, @grid, @currentCustomerCount, @monthlyDepositIncrease,
     @monthlyLoanIncrease, @monthlyNewCustomers, @maintenanceScore,
     @vsLastMonthDeposit, @vsLastMonthLoan)
  `)
  db.transaction((rows: typeof managers) => {
    for (const m of rows) insertManager.run(m)
  })(managers)

  const insertAlert = db.prepare(`
    INSERT OR IGNORE INTO alerts
    (id, type, title, severity, customer_id, customer_name, manager_name,
     amount, due_date, description, suggested_action, created_at, status)
    VALUES
    (@id, @type, @title, @severity, @customerId, @customerName, @managerName,
     @amount, @dueDate, @description, @suggestedAction, @createdAt, @status)
  `)
  db.transaction((rows: typeof alerts) => {
    for (const a of rows) {
      insertAlert.run({
        ...a,
        customerId: a.customerId ?? null,
        customerName: a.customerName ?? null,
        managerName: a.managerName ?? null,
        amount: a.amount ?? null,
        dueDate: a.dueDate ?? null,
      })
    }
  })(alerts)

  const insertVisit = db.prepare(`
    INSERT OR IGNORE INTO visits (id, customer_id, visited_at, manager, channel, summary)
    VALUES (@id, @customerId, @visitedAt, @manager, @channel, @summary)
  `)
  db.transaction((rows: typeof visits) => {
    for (const v of rows) insertVisit.run(v)
  })(visits)

  const insertProduct = db.prepare(`
    INSERT OR IGNORE INTO products (product_code, product_name, category, match_reason, expected_rate, risk_hint)
    VALUES (@productCode, @productName, @category, @matchReason, @expectedRate, @riskHint)
  `)
  db.transaction((rows: typeof depositProducts) => {
    for (const p of rows) insertProduct.run({ ...p, riskHint: p.riskHint ?? null })
  })([...depositProducts, ...loanProducts])
}

// 行转 Customer 对象
export function rowToCustomer(row: Record<string, unknown>, role?: string) {
  const customer = {
    id: row.id as string,
    name: row.name as string,
    idNoMasked: row.id_no_masked as string,
    phoneMasked: row.phone_masked as string,
    address: row.address as string,
    community: row.community as string,
    grid: row.grid as string,
    branch: row.branch as string,
    managerName: row.manager_name as string,
    avgDeposit: row.avg_deposit as number,
    mortgageLoan: row.mortgage_loan as number,
    creditLoan: row.credit_loan as number,
    hasValidContract: Boolean(row.has_valid_contract),
    usedCreditAmount: row.used_credit_amount as number,
    creditReportUpdatedAt: row.credit_report_updated_at as string | undefined,
    hasOtherBankLoan: Boolean(row.has_other_bank_loan),
    riskLevel: row.risk_level as "low" | "medium" | "high",
    segment: row.segment as "high_net_worth" | "stock" | "potential" | "new",
    lastVisitAt: row.last_visit_at as string | undefined,
    introducedAt: row.introduced_at as string | undefined,
    depositTerm: row.deposit_term as import("@/lib/mock/types").DepositTerm | undefined,
    performanceOwner: row.performance_owner as string | undefined,
  }
  if (role === "compliance" || role === "readonly") {
    return desensitizeCustomer(customer, role as "compliance" | "readonly")
  }
  return customer
}

export function rowToManager(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    branch: row.branch as string,
    grid: row.grid as string,
    currentCustomerCount: row.current_customer_count as number,
    monthlyDepositIncrease: row.monthly_deposit_increase as number,
    monthlyLoanIncrease: row.monthly_loan_increase as number,
    monthlyNewCustomers: row.monthly_new_customers as number,
    maintenanceScore: row.maintenance_score as number,
    vsLastMonthDeposit: row.vs_last_month_deposit as number,
    vsLastMonthLoan: row.vs_last_month_loan as number,
  }
}

export function rowToAlert(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    type: row.type as string,
    title: row.title as string,
    severity: row.severity as "info" | "warning" | "critical",
    customerId: row.customer_id as string | undefined,
    customerName: row.customer_name as string | undefined,
    managerName: row.manager_name as string | undefined,
    amount: row.amount as number | undefined,
    dueDate: row.due_date as string | undefined,
    description: row.description as string,
    suggestedAction: row.suggested_action as string,
    createdAt: row.created_at as string,
    status: row.status as "pending" | "processing" | "done",
  }
}

export function rowToVisit(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    visitedAt: row.visited_at as string,
    manager: row.manager as string,
    channel: row.channel as "电话" | "上门" | "网点" | "微信",
    summary: row.summary as string,
  }
}

export type DbUser = {
  id: string
  username: string
  password_hash: string
  display_name: string
  role: "manager" | "sub_branch_head" | "branch_admin" | "compliance" | "readonly"
  branch: string | null
  grid: string | null
  manager_id: string | null
  enabled: number
  last_login_at: string | null
}

// Seed preset users — idempotent, runs on every startup
function seedUsers(db: Database.Database) {
  // Use bcryptjs sync hash — precomputed for demo123 to avoid startup delay
  // rounds=12: $2b$12$... — generated once and hardcoded for determinism
  const DEMO_HASH = "$2b$12$p.W/FmtfpLbKGGr3XPQF9ei4wMxCgkQ6z.LyoHyr6C7NgXYZWt44S"

  const upsert = db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, branch, grid, manager_id)
    VALUES (@id, @username, @password_hash, @display_name, @role, @branch, @grid, @manager_id)
    ON CONFLICT(username) DO NOTHING
  `)

  const users = [
    { id: "U001", username: "lixue",       display_name: "李雪",   role: "manager",          branch: "高新支行", grid: "高新一网格", manager_id: "M001" },
    { id: "U002", username: "wangxiaodong",display_name: "王晓东", role: "manager",          branch: "高新支行", grid: "高新二网格", manager_id: "M002" },
    { id: "U003", username: "zhaomin",     display_name: "赵敏",   role: "manager",          branch: "经开支行", grid: "经开网格",   manager_id: "M003" },
    { id: "U004", username: "liuyang",     display_name: "刘洋",   role: "manager",          branch: "未央支行", grid: "未央网格",   manager_id: "M005" },
    { id: "U005", username: "zhoujianhua", display_name: "支行长-高新", role: "sub_branch_head", branch: "高新支行", grid: null, manager_id: null },
    { id: "U006", username: "admin",       display_name: "分行管理员", role: "branch_admin",   branch: null,       grid: null, manager_id: null },
    { id: "U007", username: "compliance",  display_name: "合规专员", role: "compliance",       branch: null,       grid: null, manager_id: null },
  ]

  db.transaction(() => {
    for (const u of users) {
      upsert.run({ ...u, password_hash: DEMO_HASH })
    }
  })()
}
