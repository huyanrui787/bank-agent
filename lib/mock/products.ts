import type { ProductRecommendation } from "./types"

export const depositProducts: ProductRecommendation[] = [
  {
    productCode: "DEP-3Y-EXC",
    productName: "丰年定存 3 年期",
    category: "存款",
    matchReason: "客户日均余额 28 万，偏好稳健，与 3 年期定存利率匹配。",
    expectedRate: "3.15%",
  },
  {
    productCode: "WM-SAFE-90",
    productName: "稳健理财 90 天",
    category: "理财",
    matchReason: "客户存量资金充足，可承担短期非保本理财。",
    expectedRate: "3.45%",
    riskHint: "R2 中低风险",
  },
  {
    productCode: "GOLD-AAA",
    productName: "黄金积存计划",
    category: "理财",
    matchReason: "近半年金价波动平稳，适配资产配置型客户。",
    expectedRate: "浮动",
    riskHint: "R3 中等风险",
  },
]

export const loanProducts: ProductRecommendation[] = [
  {
    productCode: "LOAN-MORT-30",
    productName: "丰年按揭循环贷",
    category: "贷款",
    matchReason: "客户有效抵押合同未用信，建议激活循环贷额度。",
    expectedRate: "LPR + 60bp",
  },
  {
    productCode: "LOAN-CRED-SME",
    productName: "小微税信贷",
    category: "贷款",
    matchReason: "客户上下游流水稳定，符合纳税评级 B 级以上。",
    expectedRate: "4.35%",
  },
  {
    productCode: "LOAN-OP-EQUIP",
    productName: "经营设备贷",
    category: "贷款",
    matchReason: "客户近 90 天有大额采购流水，疑似设备升级需求。",
    expectedRate: "4.85%",
  },
]
