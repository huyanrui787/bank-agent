/**
 * 数据分级分类（字段级）——驱动脱敏与访问控制，并注入数据字典供 NL2SQL 感知。
 * 分级口径：L1 公开（组织/非个人信息）、L2 内部（经营业务数据）、L3 敏感（个人信息 PII）。
 */

export const DATA_LEVELS = {
  L1: { label: "公开", desc: "组织/非个人信息" },
  L2: { label: "内部", desc: "经营业务数据" },
  L3: { label: "敏感", desc: "个人信息(PII)" },
} as const

export type DataLevel = keyof typeof DATA_LEVELS

/** 字段级分级（客户域；字段名为数据库真实列名 snake_case）。 */
export const FIELD_CLASSIFICATION: Record<string, DataLevel> = {
  // L1 公开 — 组织归属信息，无个人属性
  community: "L1", grid: "L1", branch: "L1", segment: "L1",
  // L2 内部 — 经营业务数据，部分脱敏
  name: "L2", manager_name: "L2", avg_deposit: "L2", mortgage_loan: "L2",
  credit_loan: "L2", used_credit_amount: "L2", has_valid_contract: "L2",
  has_other_bank_loan: "L2", risk_level: "L2", credit_report_updated_at: "L2",
  deposit_term: "L2", performance_owner: "L2", last_visit_at: "L2", introduced_at: "L2",
  // L3 敏感 — 个人信息，全掩
  id_no_masked: "L3", phone_masked: "L3", address: "L3",
}

export function dataLevelOf(field: string): DataLevel | undefined {
  return FIELD_CLASSIFICATION[field]
}
