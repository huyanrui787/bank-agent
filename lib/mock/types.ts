export type RiskLevel = "low" | "medium" | "high"

export type DepositTerm = "活期" | "3个月" | "6个月" | "1年" | "3年"

export type Customer = {
  id: string
  name: string
  idNoMasked: string
  phoneMasked: string
  address: string
  community: string
  grid: string
  branch: string
  managerName: string
  avgDeposit: number
  mortgageLoan: number
  creditLoan: number
  hasValidContract: boolean
  usedCreditAmount: number
  creditReportUpdatedAt?: string
  hasOtherBankLoan: boolean
  riskLevel: RiskLevel
  segment: "high_net_worth" | "stock" | "potential" | "new"
  lastVisitAt?: string
  introducedAt?: string      // 引入时间（今年内）
  depositTerm?: DepositTerm  // 存款期限
  performanceOwner?: string  // 绩效维护人
}

export type Manager = {
  id: string
  name: string
  branch: string
  grid: string
  currentCustomerCount: number
  monthlyDepositIncrease: number
  monthlyLoanIncrease: number
  monthlyNewCustomers: number
  maintenanceScore: number
  vsLastMonthDeposit: number
  vsLastMonthLoan: number
  monthlyData?: Record<string, {
    depositIncrease: number
    loanIncrease: number
    newCustomers: number
    vsLastMonthDeposit: number
    vsLastMonthLoan: number
  }>
}

export type BusinessAlertType =
  | "deposit_due"
  | "loan_due"
  | "financing_growth"
  | "financing_surge"
  | "new_property"
  | "grid_change"
  | "branch_abnormal"

export type AlertStatus = "pending" | "processing" | "done"
export type AlertSeverity = "info" | "warning" | "critical"

export type BusinessAlert = {
  id: string
  type: BusinessAlertType
  title: string
  severity: AlertSeverity
  customerId?: string
  customerName?: string
  managerName?: string
  amount?: number
  dueDate?: string
  description: string
  suggestedAction: string
  createdAt: string
  status: AlertStatus
}

export type VisitRecord = {
  id: string
  customerId: string
  visitedAt: string
  manager: string
  channel: "电话" | "上门" | "网点" | "微信"
  summary: string
}

export type ProductRecommendation = {
  productCode: string
  productName: string
  category: "存款" | "贷款" | "理财"
  matchReason: string
  expectedRate: string
  riskHint?: string
}

export type RiskSignal = {
  id: string
  level: AlertSeverity
  category: "征信" | "流水" | "资产" | "司法" | "经营"
  description: string
  source: string
}

export type AdmissionResult = {
  passed: boolean
  rules: { code: string; name: string; pass: boolean; note?: string }[]
  conclusion: string
}

export type CashflowAnalysis = {
  upstream: { name: string; relation: string; amount: number }[]
  downstream: { name: string; relation: string; amount: number }[]
  netInflow: number
  monthlyTrend: { month: string; inflow: number; outflow: number }[]
}

export type CustomerProfile = {
  customer: Customer
  visitRecords: VisitRecord[]
  depositRecommendation: ProductRecommendation[]
  loanRecommendation: ProductRecommendation[]
  riskSignals: RiskSignal[]
  admissionResult: AdmissionResult
  cashflowAnalysis: CashflowAnalysis
  generatedReport: string
}
