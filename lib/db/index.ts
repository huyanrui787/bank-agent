import Database from "better-sqlite3"
import path from "path"
import { CREATE_TABLES, DATA_SOURCE_TYPES } from "./schema"
import { customers } from "@/lib/mock/customers"
import { managers } from "@/lib/mock/managers"
import { alerts } from "@/lib/mock/alerts"
import { visits } from "@/lib/mock/visits"
import { depositProducts, loanProducts } from "@/lib/mock/products"
import { enterpriseCompanies, enterpriseLoans } from "@/lib/mock/enterprise"
import { settlementFlows } from "@/lib/mock/settlement"
import { guarantees } from "@/lib/mock/guarantee"
import { desensitizeCustomer } from "@/lib/auth/desensitize"
import { encryptSecret } from "@/lib/security/encrypt"

const DB_PATH = path.join(process.cwd(), "data", "bank.db")
const ENTERPRISE_DB_PATH = path.join(process.cwd(), "data", "enterprise.db")
const SETTLEMENT_DB_PATH = path.join(process.cwd(), "data", "settlement.db")
const GUARANTEE_DB_PATH = path.join(process.cwd(), "data", "guarantee.db")

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma("journal_mode = WAL")
  _db.pragma("foreign_keys = ON")
  _db.exec(CREATE_TABLES)
  migrateDataSourceTypes(_db)
  seedIfEmpty(_db)
  seedUsers(_db)
  seedEnterpriseIfEmpty()
  seedSettlementIfEmpty()
  seedGuaranteeIfEmpty()
  seedDemoDatasources(_db)
  seedChannels(_db)
  seedTasks(_db)
  return _db
}

// 迁移：data_sources 表新增向量库类型后，旧库的 CHECK 约束不会自动更新。
// 检测到缺失类型时重建表（保留已有数据），使新类型可写入。
function migrateDataSourceTypes(db: Database.Database) {
  const ddl = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='data_sources'").get() as { sql: string } | undefined)?.sql ?? ""
  if (DATA_SOURCE_TYPES.every((t) => ddl.includes(`'${t}'`))) return

  const typeSql = DATA_SOURCE_TYPES.map((t) => `'${t}'`).join(",")
  db.exec(`
    CREATE TABLE data_sources_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN (${typeSql})),
      host TEXT,
      port INTEGER,
      database_name TEXT,
      username TEXT,
      password_enc TEXT,
      extra_config TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    INSERT INTO data_sources_new
      (id,name,type,host,port,database_name,username,password_enc,extra_config,enabled,created_by,created_at,updated_at)
      SELECT id,name,type,host,port,database_name,username,password_enc,extra_config,enabled,created_by,created_at,updated_at
      FROM data_sources;
    DROP TABLE data_sources;
    ALTER TABLE data_sources_new RENAME TO data_sources;
  `)
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

// 生成独立的「企业客户」演示库 data/enterprise.db（供「数据源」模块演示接入外部库）。
function seedEnterpriseIfEmpty() {
  const db = new Database(ENTERPRISE_DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT NOT NULL,
      scale TEXT NOT NULL,
      register_capital_wan REAL NOT NULL,
      established TEXT,
      legal_rep TEXT,
      tax_level TEXT,
      risk_level TEXT,
      manager_name TEXT
    );
    CREATE TABLE IF NOT EXISTS enterprise_loans (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      loan_type TEXT NOT NULL,
      amount REAL NOT NULL,
      rate REAL,
      start_date TEXT,
      due_date TEXT,
      status TEXT
    );
  `)

  const count = (db.prepare("SELECT COUNT(*) as n FROM companies").get() as { n: number }).n
  if (count === 0) {
    const insertCompany = db.prepare(`
      INSERT INTO companies
        (id, name, industry, scale, register_capital_wan, established, legal_rep, tax_level, risk_level, manager_name)
      VALUES
        (@id, @name, @industry, @scale, @registerCapitalWan, @established, @legalRep, @taxLevel, @riskLevel, @managerName)
    `)
    db.transaction((rows: typeof enterpriseCompanies) => {
      for (const c of rows) insertCompany.run(c)
    })(enterpriseCompanies)

    const insertLoan = db.prepare(`
      INSERT INTO enterprise_loans (id, company_id, loan_type, amount, rate, start_date, due_date, status)
      VALUES (@id, @companyId, @loanType, @amount, @rate, @startDate, @dueDate, @status)
    `)
    db.transaction((rows: typeof enterpriseLoans) => {
      for (const l of rows) insertLoan.run(l)
    })(enterpriseLoans)
  }
  db.close()
}

// 生成「对公结算流水」演示库 data/settlement.db。
function seedSettlementIfEmpty() {
  const db = new Database(SETTLEMENT_DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settlement_flows (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      flow_date TEXT,
      direction TEXT,
      amount REAL,
      counterparty TEXT,
      channel TEXT
    );
  `)
  const count = (db.prepare("SELECT COUNT(*) as n FROM settlement_flows").get() as { n: number }).n
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO settlement_flows (id, company_id, flow_date, direction, amount, counterparty, channel)
      VALUES (@id, @companyId, @flowDate, @direction, @amount, @counterparty, @channel)
    `)
    db.transaction((rows: typeof settlementFlows) => {
      for (const f of rows) insert.run(f)
    })(settlementFlows)
  }
  db.close()
}

// 生成「担保关系」演示库 data/guarantee.db。
function seedGuaranteeIfEmpty() {
  const db = new Database(GUARANTEE_DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS guarantees (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      guarantor_id TEXT,
      type TEXT,
      amount REAL,
      start_date TEXT,
      end_date TEXT,
      status TEXT
    );
  `)
  const count = (db.prepare("SELECT COUNT(*) as n FROM guarantees").get() as { n: number }).n
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO guarantees (id, company_id, guarantor_id, type, amount, start_date, end_date, status)
      VALUES (@id, @companyId, @guarantorId, @type, @amount, @startDate, @endDate, @status)
    `)
    db.transaction((rows: typeof guarantees) => {
      for (const g of rows) insert.run(g)
    })(guarantees)
  }
  db.close()
}

// seed 演示数据源（幂等：缺哪个补哪个，不重复、不覆盖用户自建的）。
// SQLite 三个零外部依赖；MySQL/PostgreSQL 依赖 Docker 容器（见 README 演示脚本）。
function seedDemoDatasources(db: Database.Database) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO data_sources
      (id, name, type, host, port, database_name, username, password_enc, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const datasources = [
    { id: "DS-enterprise", name: "企业客户库", type: "sqlite", host: null, port: null, db: "data/enterprise.db", user: null, pw: null },
    { id: "DS-settlement", name: "对公结算流水库", type: "sqlite", host: null, port: null, db: "data/settlement.db", user: null, pw: null },
    { id: "DS-guarantee", name: "担保关系库", type: "sqlite", host: null, port: null, db: "data/guarantee.db", user: null, pw: null },
    { id: "DS-mysql", name: "对公信贷库(MySQL)", type: "mysql", host: "127.0.0.1", port: 3306, db: "corp_credit", user: "root", pw: "demo123" },
    { id: "DS-pg", name: "企业画像库(PostgreSQL)", type: "postgresql", host: "127.0.0.1", port: 5432, db: "corp_profile", user: "postgres", pw: "demo123" },
  ]
  db.transaction(() => {
    for (const ds of datasources) {
      insert.run(ds.id, ds.name, ds.type, ds.host, ds.port, ds.db, ds.user, ds.pw ? encryptSecret(ds.pw) : null, 1)
    }
  })()
}

// 首次启动时 seed 演示通知渠道（外部依赖的 URL/凭证留空，由使用者填写真实值）。
function seedChannels(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as n FROM notification_channels").get() as { n: number }).n
  if (count > 0) return
  const insert = db.prepare(`
    INSERT INTO notification_channels (id, name, type, enabled, config)
    VALUES (?, ?, ?, ?, ?)
  `)
  const channels = [
    { id: "CH-wechat", name: "企业微信群机器人", type: "wechat_webhook", config: { webhookUrl: "" } },
    { id: "CH-sms", name: "短信通知", type: "sms", config: { smsAppKey: "", smsAppSecret: "", smsSignName: "龙湾农商行", smsTemplateCode: "" } },
    { id: "CH-webhook", name: "自定义演示 Webhook", type: "custom_webhook", config: { url: "" } },
  ]
  db.transaction(() => {
    for (const ch of channels) insert.run(ch.id, ch.name, ch.type, 1, JSON.stringify(ch.config))
  })()
}

// 首次启动时为每个内置用户 seed 3 条演示定时任务（每日/每周/每月）。
function seedTasks(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as n FROM tasks").get() as { n: number }).n
  if (count > 0) return
  const insert = db.prepare(`
    INSERT INTO tasks
      (id, user_id, title, description, trigger_at, recurrence, weekday, month_day, related_customer, enabled, done, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
  `)

  const userIds = ["U001", "U002", "U003", "U004", "U005", "U006", "U007"]
  const templates = [
    { title: "存量客户存款到期回访", description: "每日回访即将到期的存量客户，做好续存对接", triggerAt: "2026-08-19T09:00", recurrence: "daily", weekday: null, monthDay: null },
    { title: "本周新增客户梳理", description: "每周一梳理本周新引入客户，安排跟进", triggerAt: "2026-08-19T09:30", recurrence: "weekly", weekday: 1, monthDay: null },
    { title: "贷款到期客户排查", description: "每月28日排查下月到期贷款客户，提前安排续作", triggerAt: "2026-08-19T17:00", recurrence: "monthly", weekday: null, monthDay: 28 },
  ]

  const now = new Date().toISOString()
  let n = 1
  db.transaction(() => {
    for (const uid of userIds) {
      for (const t of templates) {
        insert.run(
          `T${String(n++).padStart(3, "0")}`, uid, t.title, t.description, t.triggerAt,
          t.recurrence, t.weekday, t.monthDay, null, now
        )
      }
    }
  })()
}
