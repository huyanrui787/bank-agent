/**
 * 字段映射层：把「业务逻辑字段」（lib/mock/types.ts 里的 camelCase 字段，单一事实源）
 * 映射到「真实库列名」。默认是 bank.db 的恒等映射；真实库接入时通过数据源的
 * extra_config.columnMapping 覆盖，业务代码无需改动。
 */

export type ColumnMap = Record<string, string> // 逻辑字段 → 真实列名
export type TableMap = { table: string; columns: ColumnMap }
export type BusinessMapping = {
  customer: TableMap
  manager: TableMap
  alert: TableMap
  visit: TableMap
  product: TableMap
}

export type MappingOverride = Partial<{
  [K in keyof BusinessMapping]: { table?: string; columns?: ColumnMap }
}>

/** 默认映射：bank.db 五张业务表的恒等映射（camelCase 逻辑字段 → snake_case 列名） */
export const DEFAULT_MAPPING: BusinessMapping = {
  customer: {
    table: "customers",
    columns: {
      id: "id",
      name: "name",
      idNoMasked: "id_no_masked",
      phoneMasked: "phone_masked",
      address: "address",
      community: "community",
      grid: "grid",
      branch: "branch",
      managerName: "manager_name",
      avgDeposit: "avg_deposit",
      mortgageLoan: "mortgage_loan",
      creditLoan: "credit_loan",
      hasValidContract: "has_valid_contract",
      usedCreditAmount: "used_credit_amount",
      creditReportUpdatedAt: "credit_report_updated_at",
      hasOtherBankLoan: "has_other_bank_loan",
      riskLevel: "risk_level",
      segment: "segment",
      lastVisitAt: "last_visit_at",
      introducedAt: "introduced_at",
      depositTerm: "deposit_term",
      performanceOwner: "performance_owner",
    },
  },
  manager: {
    table: "managers",
    columns: {
      id: "id",
      name: "name",
      branch: "branch",
      grid: "grid",
      currentCustomerCount: "current_customer_count",
      monthlyDepositIncrease: "monthly_deposit_increase",
      monthlyLoanIncrease: "monthly_loan_increase",
      monthlyNewCustomers: "monthly_new_customers",
      maintenanceScore: "maintenance_score",
      vsLastMonthDeposit: "vs_last_month_deposit",
      vsLastMonthLoan: "vs_last_month_loan",
    },
  },
  alert: {
    table: "alerts",
    columns: {
      id: "id",
      type: "type",
      title: "title",
      severity: "severity",
      customerId: "customer_id",
      customerName: "customer_name",
      managerName: "manager_name",
      amount: "amount",
      dueDate: "due_date",
      description: "description",
      suggestedAction: "suggested_action",
      createdAt: "created_at",
      status: "status",
    },
  },
  visit: {
    table: "visits",
    columns: {
      id: "id",
      customerId: "customer_id",
      visitedAt: "visited_at",
      manager: "manager",
      channel: "channel",
      summary: "summary",
    },
  },
  product: {
    table: "products",
    columns: {
      productCode: "product_code",
      productName: "product_name",
      category: "category",
      matchReason: "match_reason",
      expectedRate: "expected_rate",
      riskHint: "risk_hint",
    },
  },
}

/** 用数据源 extra_config 的 columnMapping 覆盖默认映射（表名 / 列名均可覆盖） */
export function mergeMapping(base: BusinessMapping, override?: MappingOverride): BusinessMapping {
  if (!override) return base
  const result = { ...base }
  for (const key of Object.keys(base) as (keyof BusinessMapping)[]) {
    const o = override[key]
    if (o) {
      result[key] = {
        table: o.table ?? base[key].table,
        columns: { ...base[key].columns, ...(o.columns ?? {}) },
      }
    }
  }
  return result
}
