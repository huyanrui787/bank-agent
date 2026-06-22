export function toCSV(rows: Record<string, unknown>[], columns?: { key: string; label: string }[]) {
  if (rows.length === 0) return ""
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const header = cols.map((c) => escape(c.label)).join(",")
  const body = rows
    .map((row) => cols.map((c) => escape((row as Record<string, unknown>)[c.key])).join(","))
    .join("\n")
  return `${header}\n${body}`
}

export const customerCsvColumns = [
  { key: "id", label: "客户编号" },
  { key: "name", label: "客户姓名" },
  { key: "idNoMasked", label: "身份证号" },
  { key: "phoneMasked", label: "联系方式" },
  { key: "address", label: "联系地址" },
  { key: "community", label: "小区" },
  { key: "grid", label: "网格" },
  { key: "branch", label: "支行" },
  { key: "managerName", label: "客户经理" },
  { key: "avgDeposit", label: "日均存款" },
  { key: "depositTerm", label: "存款期限" },
  { key: "mortgageLoan", label: "抵押贷款余额" },
  { key: "creditLoan", label: "信用贷款余额" },
  { key: "hasValidContract", label: "是否有效合同" },
  { key: "usedCreditAmount", label: "当前用信" },
  { key: "hasOtherBankLoan", label: "他行有贷" },
  { key: "riskLevel", label: "风险等级" },
  { key: "introducedAt", label: "引入时间" },
  { key: "performanceOwner", label: "绩效维护人" },
]

export const managerCsvColumns = [
  { key: "id", label: "经理编号" },
  { key: "name", label: "客户经理" },
  { key: "branch", label: "支行" },
  { key: "grid", label: "网格" },
  { key: "currentCustomerCount", label: "当前管户数" },
  { key: "monthlyDepositIncrease", label: "本月新增存款" },
  { key: "monthlyLoanIncrease", label: "本月新增贷款" },
  { key: "monthlyNewCustomers", label: "本月新增客户" },
  { key: "maintenanceScore", label: "维护得分" },
  { key: "vsLastMonthDeposit", label: "存款环比%" },
  { key: "vsLastMonthLoan", label: "贷款环比%" },
]

export const alertCsvColumns = [
  { key: "id", label: "预警编号" },
  { key: "type", label: "类型" },
  { key: "severity", label: "等级" },
  { key: "title", label: "标题" },
  { key: "customerName", label: "客户" },
  { key: "managerName", label: "客户经理" },
  { key: "amount", label: "涉及金额" },
  { key: "dueDate", label: "到期日" },
  { key: "status", label: "状态" },
  { key: "createdAt", label: "生成时间" },
  { key: "description", label: "说明" },
  { key: "suggestedAction", label: "建议动作" },
]
