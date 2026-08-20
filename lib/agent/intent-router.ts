import type { Intent } from "./types"

export function detectIntent(input: string): Intent {
  // 知识问答：政策/利率/合规/准入等知识性问题（优先于其它意图，避免被"查询/分析"误匹配）
  if (
    ["政策", "利率", "合规", "额度", "准入", "反洗钱", "KYC", "展期", "贷前调查",
     "黑名单", "限入", "受托支付", "LPR", "存款利率", "贷款利率", "申请条件",
     "大额交易", "实地调查", "关联企业", "资金用途", "数据宝", "了解你的客户"].some((k) => input.includes(k))
  ) {
    return "knowledge"
  }

  if (
    input.includes("客户清单") ||
    input.includes("梳理") ||
    input.includes("日均存款") ||
    input.includes("筛选") ||
    input.includes("小区")
  ) {
    return "customer_segment"
  }

  if (
    input.includes("客户经理") ||
    input.includes("分配") ||
    input.includes("新增存贷") ||
    input.includes("新增客户") ||
    input.includes("绩效") ||
    input.includes("排名")
  ) {
    return "vertical_management"
  }

  if (
    input.includes("预警") ||
    input.includes("到期") ||
    input.includes("融资") ||
    input.includes("异常")
  ) {
    return "business_alert"
  }

  if (input.includes("报告") || input.includes("调查")) {
    return "generate_report"
  }

  if (
    input.includes("话术") ||
    input.includes("催收") ||
    input.includes("营销话术") ||
    input.includes("续存话术") ||
    input.includes("转介绍")
  ) {
    return "generate_script"
  }

  if (
    (input.includes("查询") || input.includes("查看")) && (
      input.includes("走访") ||
      input.includes("产品") ||
      input.includes("记录") ||
      input.includes("数据")
    )
  ) {
    return "query_database"
  }

  if (
    input.includes("查询") ||
    input.includes("分析") ||
    input.includes("风险") ||
    input.includes("画像")
  ) {
    return "customer_analysis"
  }

  return "unknown"
}

export function extractFilters(input: string): {
  community?: string
  minAvgDeposit?: number
  hasOtherBankLoan?: boolean
  hasValidContract?: boolean
  unusedCredit?: boolean
} {
  const filters: ReturnType<typeof extractFilters> = {}

  const community = input.match(/(高新区·锦园|高新区·瑞华苑|雁塔·紫薇花园|未央·凤城三号|经开区·上林苑|曲江·翠华南苑|XX小区|XX 小区|某小区|[^\s，,]+小区)/)
  if (community) {
    filters.community = community[1].replace(" ", "")
  }

  const amountMatch = input.match(/(?:大于|超过|高于|>=?|超出)\s*(\d+)\s*(万|w|w元|万元)?/i)
  if (amountMatch) {
    const num = parseInt(amountMatch[1], 10)
    filters.minAvgDeposit = amountMatch[2] ? num * 10000 : num
  } else if (input.includes("日均存款")) {
    filters.minAvgDeposit = 100_000
  }

  if (input.includes("他行有贷") || input.includes("无贷有贷")) {
    filters.hasOtherBankLoan = true
  }

  if (input.includes("有效合同") || input.includes("未用信")) {
    filters.hasValidContract = true
    if (input.includes("未用信")) filters.unusedCredit = true
  }

  return filters
}
