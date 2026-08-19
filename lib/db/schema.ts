export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  id_no_masked TEXT,
  phone_masked TEXT,
  address TEXT,
  community TEXT,
  grid TEXT,
  branch TEXT,
  manager_name TEXT,
  avg_deposit REAL DEFAULT 0,
  mortgage_loan REAL DEFAULT 0,
  credit_loan REAL DEFAULT 0,
  has_valid_contract INTEGER DEFAULT 0,
  used_credit_amount REAL DEFAULT 0,
  credit_report_updated_at TEXT,
  has_other_bank_loan INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'low',
  segment TEXT DEFAULT 'new',
  last_visit_at TEXT,
  introduced_at TEXT,
  deposit_term TEXT,
  performance_owner TEXT
);

CREATE TABLE IF NOT EXISTS managers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  branch TEXT,
  grid TEXT,
  current_customer_count INTEGER DEFAULT 0,
  monthly_deposit_increase REAL DEFAULT 0,
  monthly_loan_increase REAL DEFAULT 0,
  monthly_new_customers INTEGER DEFAULT 0,
  maintenance_score INTEGER DEFAULT 0,
  vs_last_month_deposit REAL DEFAULT 0,
  vs_last_month_loan REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT,
  severity TEXT DEFAULT 'info',
  customer_id TEXT,
  customer_name TEXT,
  manager_name TEXT,
  amount REAL,
  due_date TEXT,
  description TEXT,
  suggested_action TEXT,
  created_at TEXT,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  visited_at TEXT,
  manager TEXT,
  channel TEXT,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS products (
  product_code TEXT PRIMARY KEY,
  product_name TEXT,
  category TEXT,
  match_reason TEXT,
  expected_rate TEXT,
  risk_hint TEXT
);

CREATE TABLE IF NOT EXISTS custom_skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  input_schema_description TEXT,
  output_type TEXT DEFAULT 'report',
  enabled INTEGER DEFAULT 1,
  category TEXT DEFAULT '分析',
  sample_prompt TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('manager','sub_branch_head','branch_admin','compliance','readonly')),
  branch TEXT,
  grid TEXT,
  manager_id TEXT,
  enabled INTEGER DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  prev_hash TEXT NOT NULL DEFAULT '',
  entry_hash TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_branch TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  summary TEXT NOT NULL,
  detail TEXT,
  ip_address TEXT,
  request_id TEXT,
  data_scope TEXT,
  record_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_logs
  BEGIN SELECT RAISE(ABORT,'audit logs are immutable'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_logs
  BEGIN SELECT RAISE(ABORT,'audit logs are immutable'); END;
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_logs(action, created_at DESC);
CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('wechat_webhook','longlong','sms','custom_webhook')),
  enabled INTEGER DEFAULT 1,
  config TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN (
    'sqlite','mysql','postgresql','sqlserver','oracle',
    'db2','hive','impala','elasticsearch','dtsql','vector_pgvector','vector_milvus'
  )),
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
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  definition TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  enabled INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  trigger_at TEXT NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'none',
  weekday INTEGER,
  month_day INTEGER,
  related_customer TEXT,
  enabled INTEGER DEFAULT 1,
  done INTEGER DEFAULT 0,
  last_fired_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, enabled, done);
`
