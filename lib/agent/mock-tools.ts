import { customers } from "@/lib/mock/customers"
import { managers } from "@/lib/mock/managers"
import { alerts } from "@/lib/mock/alerts"
import { depositProducts, loanProducts } from "@/lib/mock/products"
import { visits } from "@/lib/mock/visits"
import { generateScript } from "@/lib/mock/scripts"
import { checkAdmissionRules } from "@/lib/mock/admission-rules"
import type { Customer, CustomerProfile } from "@/lib/mock/types"
import type { AccessTokenPayload } from "@/lib/auth/jwt"
import type { DataScope } from "@/lib/auth/scope"
import { detectIntent, extractFilters } from "./intent-router"
import type { AgentResponse, AgentStep, StreamEvent } from "./types"

function step(id: number, title: string, description: string, status: AgentStep["status"] = "done"): AgentStep {
  return { id: String(id), title, description, status }
}

export type MockAgentCtx = {
  user: Pick<AccessTokenPayload, "name" | "branch" | "managerId">
  scope: DataScope
}

/** 在内存 mock 数据上按数据范围过滤（与 buildScope 语义一致：personal / branch / bank）。 */
function applyScope(ctx?: MockAgentCtx) {
  const type = ctx?.scope?.type ?? "bank"
  const name = ctx?.user?.name ?? null
  const branch = ctx?.user?.branch ?? null
  const managerId = ctx?.user?.managerId ?? null

  const cs =
    type === "personal" ? customers.filter((c) => c.managerName === name)
    : type === "branch" ? customers.filter((c) => c.branch === branch)
    : customers
  const ms =
    type === "personal" ? managers.filter((m) => m.name === name || m.id === managerId)
    : type === "branch" ? managers.filter((m) => m.branch === branch)
    : managers
  const branchManagers = new Set(managers.filter((m) => m.branch === branch).map((m) => m.name))
  const as =
    type === "personal" ? alerts.filter((a) => a.managerName === name)
    : type === "branch" ? alerts.filter((a) => branchManagers.has(a.managerName ?? ""))
    : alerts
  return { cs, ms, as }
}

/** 在已过滤的客户集合内定位客户（编号/姓名精确 → 姓名包含），找不到返回 undefined。 */
function locateCustomer(message: string, cs: Customer[]): Customer | undefined {
  const tokens = message.split(/[\s,，。、]+/).filter(Boolean)
  return (
    cs.find((c) => tokens.some((t) => c.id === t || c.id === t.toUpperCase() || c.name === t)) ??
    cs.find((c) => tokens.some((t) => c.name.includes(t)))
  )
}

/** 把 mock 响应包装成与真实 LLM 一致的 SSE 事件流（无网络依赖的确定性兜底）。 */
export async function* streamMockAgent(message: string, ctx?: MockAgentCtx): AsyncGenerator<StreamEvent> {
  const response = runMockAgent(message, ctx)
  response._agent = "mock"
  for (const s of response.steps) {
    yield { type: "step", step: s }
  }
  yield { type: "done", response }
}

export function runMockAgent(message: string, ctx?: MockAgentCtx): AgentResponse {
  const intent = detectIntent(message)

  switch (intent) {
    case "customer_segment":
      return handleSegment(message, ctx)
    case "vertical_management":
      return handleVertical(ctx)
    case "business_alert":
      return handleAlert(ctx)
    case "customer_analysis":
      return handleAnalysis(message, ctx)
    case "generate_report":
      return handleReport(message, ctx)
    case "generate_script":
      return handleScript(message, ctx)
    case "query_database":
      return handleQuery(message, ctx)
    case "export_data":
      return handleExport()
    default:
      return handleUnknown(message)
  }
}

function handleSegment(message: string, ctx?: MockAgentCtx): AgentResponse {
  const filters = extractFilters(message)
  const { cs } = applyScope(ctx)
  let list = cs
  const conditions: string[] = []

  if (filters.community) {
    list = list.filter((c) => c.community.includes(filters.community!) || filters.community === "XX小区")
    conditions.push(`小区=${filters.community}`)
  }
  if (filters.minAvgDeposit) {
    list = list.filter((c) => c.avgDeposit >= filters.minAvgDeposit!)
    conditions.push(`日均存款≥¥${filters.minAvgDeposit.toLocaleString()}`)
  }
  if (filters.hasOtherBankLoan) {
    list = list.filter((c) => c.hasOtherBankLoan && c.mortgageLoan === 0 && c.creditLoan === 0)
    conditions.push("本行无贷·他行有贷")
  }
  if (filters.hasValidContract) {
    list = list.filter((c) => c.hasValidContract && (!filters.unusedCredit || c.usedCreditAmount === 0))
    conditions.push(filters.unusedCredit ? "有效合同·未用信" : "有效合同")
  }

  if (list.length === cs.length) {
    list = cs.filter((c) => c.avgDeposit >= 100_000).slice(0, 24)
    conditions.push("默认条件：日均存款≥¥100,000")
  }

  const top = list.slice(0, 30)

  return {
    intent: "customer_segment",
    summary: `已为你筛选 ${top.length} 位客户${conditions.length ? "，条件：" + conditions.join("、") : ""}。`,
    steps: [
      step(1, "识别需求", "识别为客群梳理任务"),
      step(2, "匹配字段", `提取条件：${conditions.join("、") || "无明确条件"}`),
      step(3, "查询客户库", `共扫描 ${cs.length} 位客户`),
      step(4, "生成清单", `筛选出 ${list.length} 位匹配客户，截取前 ${top.length} 位展示`),
      step(5, "准备导出", "可一键导出为 CSV / Excel"),
    ],
    resultType: "table",
    data: top,
    suggestedNextActions: ["导出 Excel", "按客户经理拆分", "生成营销话术"],
  }
}

function handleVertical(ctx?: MockAgentCtx): AgentResponse {
  const { ms } = applyScope(ctx)
  const ranking = [...ms].sort((a, b) => b.monthlyDepositIncrease - a.monthlyDepositIncrease)
  const totalNewCustomers = ms.reduce((s, m) => s + m.monthlyNewCustomers, 0)
  return {
    intent: "vertical_management",
    summary: `已统计 ${ms.length} 位客户经理本月业绩，新增客户合计 ${totalNewCustomers} 户。`,
    steps: [
      step(1, "识别需求", "识别为垂直管理任务"),
      step(2, "汇总指标", "汇总各经理新增客户、存贷增长、维护得分"),
      step(3, "环比分析", "对比上月波动情况"),
      step(4, "输出排名", "按本月新增存款金额排序"),
    ],
    resultType: "table",
    data: ranking,
    suggestedNextActions: ["导出经理绩效表", "查看绩效较低经理", "下发督导任务"],
  }
}

function handleAlert(ctx?: MockAgentCtx): AgentResponse {
  const { as } = applyScope(ctx)
  const sorted = [...as].sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 } as const
    return sev[a.severity] - sev[b.severity]
  })
  const criticalCount = as.filter((a) => a.severity === "critical").length
  return {
    intent: "business_alert",
    summary: `共扫描出 ${as.length} 条预警，其中紧急 ${criticalCount} 条需要立即处理。`,
    steps: [
      step(1, "识别需求", "识别为业务预警任务"),
      step(2, "扫描多源数据", "扫描存款、贷款、融资、网格、支行数据"),
      step(3, "聚合预警", `生成 ${as.length} 条预警事件`),
      step(4, "排序分发", "按严重度排序，分发至对应客户经理"),
    ],
    resultType: "alert",
    data: sorted,
    suggestedNextActions: ["查看紧急预警详情", "导出预警清单", "派发处理任务"],
  }
}

function handleAnalysis(message: string, ctx?: MockAgentCtx): AgentResponse {
  const { cs } = applyScope(ctx)
  const customer = locateCustomer(message, cs)
  if (!customer) {
    return {
      intent: "customer_analysis",
      summary: "未在你的数据权限范围内找到客户，请确认姓名或编号。",
      steps: [
        step(1, "识别需求", "识别为客户画像分析任务"),
        step(2, "定位客户", "未命中可访问的客户", "error"),
      ],
      resultType: "empty",
      data: null,
      suggestedNextActions: ["分析张明的风险情况"],
    }
  }

  const profile = buildProfile(customer.id)

  return {
    intent: "customer_analysis",
    summary: `已为客户 ${customer.name} 完成 360° 画像分析，输出风险信号 ${profile.riskSignals.length} 项。`,
    steps: [
      step(1, "识别需求", "识别为客户画像分析任务"),
      step(2, "定位客户", `命中客户 ${customer.name}（${customer.id}）`),
      step(3, "拉取数据", "汇总征信、存贷、流水、走访、风险数据"),
      step(4, "生成画像", "输出可视化画像与产品推荐"),
    ],
    resultType: "profile",
    data: profile,
    suggestedNextActions: ["生成调查报告", "导出风险摘要", "生成营销话术"],
  }
}

function handleReport(message: string, ctx?: MockAgentCtx): AgentResponse {
  const { cs } = applyScope(ctx)
  const customer = locateCustomer(message, cs)
  if (!customer) {
    return {
      intent: "generate_report",
      summary: "未在你的数据权限范围内找到客户，无法生成调查报告。",
      steps: [
        step(1, "识别需求", "识别为调查报告生成任务"),
        step(2, "定位客户", "未命中可访问的客户", "error"),
      ],
      resultType: "empty",
      data: null,
      suggestedNextActions: ["分析张明的风险情况"],
    }
  }
  const profile = buildProfile(customer.id)
  return {
    intent: "generate_report",
    summary: `已为客户 ${customer.name} 生成贷前调查报告草稿（${profile.generatedReport.length} 字）。`,
    steps: [
      step(1, "识别需求", "识别为调查报告生成任务"),
      step(2, "拉取客户档案", `读取 ${customer.name} 的基础信息与流水`),
      step(3, "结构化生成", "按模板生成基础、经营、风险、结论四段"),
      step(4, "可复核输出", "标注字段来源，便于人工复核"),
    ],
    resultType: "report",
    data: profile,
    suggestedNextActions: ["复制报告", "导出 Markdown", "提交合规复核"],
  }
}

function handleExport(): AgentResponse {
  return {
    intent: "export_data",
    summary: "已准备客户清单的 Excel 导出任务，点击下方按钮即可下载。",
    steps: [
      step(1, "识别需求", "识别为数据导出任务"),
      step(2, "校验字段", "对身份证号、手机号进行脱敏校验"),
      step(3, "生成文件", "已生成 customers.xlsx（带表头样式 / 冻结首行 / 自动筛选）"),
    ],
    resultType: "file",
    data: {
      url: "/api/export?type=customers&format=xlsx",
      filename: "customers.xlsx",
      format: "xlsx",
    },
    suggestedNextActions: ["下载文件", "切换导出对象（预警 / 经理）", "切换为 CSV 格式"],
  }
}

function handleScript(message: string, ctx?: MockAgentCtx): AgentResponse {
  const { cs } = applyScope(ctx)
  const customer = locateCustomer(message, cs)
  if (!customer) {
    return {
      intent: "generate_script",
      summary: "未在你的数据权限范围内找到客户，无法生成话术。",
      steps: [
        step(1, "识别需求", "识别为话术生成任务"),
        step(2, "定位客户", "未命中可访问的客户", "error"),
      ],
      resultType: "empty",
      data: null,
      suggestedNextActions: ["分析张明的风险情况"],
    }
  }

  const result = generateScript(customer, message)

  const scriptContent = `# ${result.title}

**客户等级：** ${result.grade}类  **场景：** ${result.scene}  **渠道：** ${result.channel}

---

${result.content}

---

**使用建议：**
${result.tips.map((t) => `- ${t}`).join("\n")}`

  return {
    intent: "generate_script",
    summary: `已为 ${customer.name}（${result.grade}类客户）生成${result.scene}话术，渠道：${result.channel}。`,
    steps: [
      step(1, "识别需求", "识别为话术生成任务"),
      step(2, "定位客户", `命中客户 ${customer.name}（${customer.id}），风险等级：${customer.riskLevel}`),
      step(3, "判断客户等级", `五级分类：${result.grade}类，场景：${result.scene}`),
      step(4, "生成话术", `已生成${result.channel}${result.scene}话术，含 ${result.tips.length} 条使用建议`),
    ],
    resultType: "report",
    data: { ...buildProfile(customer.id), generatedReport: scriptContent },
    suggestedNextActions: ["复制话术", "切换渠道（微信/上门）", "生成调查报告"],
  }
}

function handleQuery(message: string, ctx?: MockAgentCtx): AgentResponse {
  const { cs, ms, as } = applyScope(ctx)
  let table = "customers"
  let data: unknown = []
  let tableLabel = "客户"

  if (message.includes("走访") || message.includes("拜访")) {
    table = "visits"
    tableLabel = "走访记录"
    const customerMatch = locateCustomer(message, cs)
    data = customerMatch
      ? visits.filter((v) => v.customerId === customerMatch.id)
      : visits.filter((v) => cs.some((c) => c.id === v.customerId))
  } else if (message.includes("产品") || message.includes("理财") || message.includes("存款产品")) {
    table = "products"
    tableLabel = "产品"
    data = [...depositProducts, ...loanProducts]
  } else if (message.includes("经理") || message.includes("绩效")) {
    table = "managers"
    tableLabel = "客户经理"
    data = ms
  } else if (message.includes("预警")) {
    table = "alerts"
    tableLabel = "预警"
    data = as.slice(0, 20)
  } else {
    data = cs.filter((c) => c.riskLevel === "high").slice(0, 20)
    tableLabel = "高风险客户"
  }

  const count = Array.isArray(data) ? (data as unknown[]).length : 0

  return {
    intent: "query_database",
    summary: `已自动选取「${tableLabel}」数据表，查询到 ${count} 条记录。`,
    steps: [
      step(1, "解析查询意图", `识别目标数据表：${tableLabel}（${table}）`),
      step(2, "自动选表", `根据语义自动选取 ${table} 表，无需手动指定`),
      step(3, "执行查询", `扫描数据，命中 ${count} 条记录`),
      step(4, "返回结果", "已格式化输出，可进一步筛选或导出"),
    ],
    resultType: "table",
    data,
    suggestedNextActions: ["导出结果", "进一步筛选", "生成分析报告"],
  }
}

function handleUnknown(message: string): AgentResponse {
  return {
    intent: "unknown",
    summary: "暂未识别到匹配技能，可尝试以下快捷指令。",
    steps: [
      step(1, "识别需求", "未匹配到内置意图", "error"),
      step(2, "建议", "请尝试『客户清单 / 预警 / 风险 / 报告 / 导出』等关键词", "done"),
    ],
    resultType: "empty",
    data: { input: message },
    suggestedNextActions: [
      "梳理高日均存款客户",
      "扫描本月业务预警",
      "分析张明的风险情况",
      "导出客户清单",
    ],
  }
}

export function buildProfile(customerId: string): CustomerProfile {
  const customer = customers.find((c) => c.id === customerId) ?? customers[0]
  const myVisits = visits.filter((v) => v.customerId === customer.id)
  const fallbackVisits = myVisits.length
    ? myVisits
    : [
        {
          id: `V-${customer.id}-1`,
          customerId: customer.id,
          visitedAt: customer.lastVisitAt ?? "2026-04-10",
          manager: customer.managerName,
          channel: "电话" as const,
          summary: "客户经理电话回访，客户反馈近期资金有一定波动，预约面谈。",
        },
      ]

  const riskSignals = [
    {
      id: "R1",
      level: "warning" as const,
      category: "征信" as const,
      description: `近 6 个月外部查询 ${4 + (customer.id.charCodeAt(2) % 5)} 次，需关注负债扩张趋势。`,
      source: "人行征信报告 / 2026-04-12",
    },
    customer.hasOtherBankLoan
      ? {
          id: "R2",
          level: "warning" as const,
          category: "资产" as const,
          description: "客户在他行存在贷款余额，未来潜在多头授信风险。",
          source: "人行征信报告",
        }
      : {
          id: "R2",
          level: "info" as const,
          category: "资产" as const,
          description: "暂无他行贷款记录，整体负债结构清晰。",
          source: "本行核心系统",
        },
    {
      id: "R3",
      level: (customer.riskLevel === "high" ? "critical" : "info") as "critical" | "info",
      category: "流水" as const,
      description:
        customer.riskLevel === "high"
          ? "近 30 天存在大额异常流水，建议启动反洗钱核查。"
          : "近 30 天流水稳定，未触发反洗钱风控。",
      source: "反洗钱监测平台",
    },
  ]

  const admissionRuleDetails = checkAdmissionRules(customer)
  const overallPassed = admissionRuleDetails.every(
    (d) => d.status !== "hit"
  )
  const admissionResult = {
    passed: overallPassed,
    rules: admissionRuleDetails.flatMap((d) =>
      d.rules.map((r) => ({
        code: r.code,
        name: `[${d.categoryLabel}] ${r.name}`,
        pass: r.status !== "hit",
        note: r.status === "hit" ? r.detail : undefined,
      }))
    ),
    conclusion: overallPassed
      ? "符合普惠经营快速准入条件，可继续下一步授信流程。"
      : "存在风险信号，建议谨慎准入，需补充材料或经审批后方可准入。",
    details: admissionRuleDetails,
  }

  const cashflowAnalysis = {
    upstream: [
      { name: "西安瑞华机械有限公司", relation: "主供应商", amount: 1_280_000 },
      { name: "陕西宏达原材料", relation: "原材料采购", amount: 860_000 },
      { name: "高新区电力", relation: "公共费用", amount: 120_000 },
    ],
    downstream: [
      { name: "西部新能源科技", relation: "主销客户", amount: 2_140_000 },
      { name: "京东工业品", relation: "渠道销售", amount: 760_000 },
      { name: "陕西机电进出口", relation: "出口代理", amount: 1_180_000 },
    ],
    netInflow: 1_460_000,
    monthlyTrend: [
      { month: "2025-12", inflow: 2_140_000, outflow: 1_820_000 },
      { month: "2026-01", inflow: 2_280_000, outflow: 1_900_000 },
      { month: "2026-02", inflow: 2_640_000, outflow: 2_180_000 },
      { month: "2026-03", inflow: 2_940_000, outflow: 2_320_000 },
      { month: "2026-04", inflow: 3_280_000, outflow: 2_540_000 },
      { month: "2026-05", inflow: 3_460_000, outflow: 2_640_000 },
    ],
  }

  const generatedReport = buildReportText(customer.name, customer, admissionResult.conclusion)

  const netInflow = cashflowAnalysis.netInflow

  const depositRec = netInflow > 2_000_000
    ? [
        {
          productCode: "DEP-3Y-EXC",
          productName: "丰年定存 3 年期",
          category: "存款" as const,
          matchReason: `客户月均净流入 ¥${(netInflow / 10000).toFixed(0)}万，资金充裕，适合锁定 3 年期高息定存。`,
          expectedRate: "2.45%",
        },
        {
          productCode: "WM-SAFE-90",
          productName: "稳健理财 90 天",
          category: "理财" as const,
          matchReason: "上下游资金流转频繁，短期理财兼顾流动性与收益。",
          expectedRate: "3.45%",
          riskHint: "R2 中低风险",
        },
        {
          productCode: "GOLD-AAA",
          productName: "黄金积存计划",
          category: "理财" as const,
          matchReason: "资产规模较大，建议配置黄金对冲通胀风险。",
          expectedRate: "浮动",
          riskHint: "R3 中等风险",
        },
      ]
    : netInflow > 500_000
    ? [
        {
          productCode: "DEP-1Y-STD",
          productName: "丰年定存 1 年期",
          category: "存款" as const,
          matchReason: `客户月均净流入 ¥${(netInflow / 10000).toFixed(0)}万，适合 1 年期定存，兼顾灵活性。`,
          expectedRate: "1.65%",
        },
        {
          productCode: "WM-SAFE-90",
          productName: "稳健理财 90 天",
          category: "理财" as const,
          matchReason: "资金流动性需求中等，短期理财收益优于活期。",
          expectedRate: "3.45%",
          riskHint: "R2 中低风险",
        },
      ]
    : [
        {
          productCode: "DEP-6M-STD",
          productName: "丰年定存 6 个月",
          category: "存款" as const,
          matchReason: "资金流动性需求较高，建议短期定存，随时可续存。",
          expectedRate: "1.45%",
        },
      ]

  const loanRec = customer.hasValidContract && customer.usedCreditAmount === 0
    ? [
        {
          productCode: "LOAN-MORT-30",
          productName: "丰年按揭循环贷",
          category: "贷款" as const,
          matchReason: "客户有效抵押合同未用信，建议激活循环贷额度，随借随还。",
          expectedRate: "LPR + 60bp",
        },
        ...(!customer.hasOtherBankLoan ? [{
          productCode: "LOAN-CRED-SME",
          productName: "小微税信贷",
          category: "贷款" as const,
          matchReason: "上下游流水稳定，符合纳税评级 B 级以上，可申请纯信用贷款。",
          expectedRate: "4.35%",
        }] : []),
      ]
    : customer.hasOtherBankLoan
    ? [
        {
          productCode: "LOAN-REFI",
          productName: "他行贷款置换方案",
          category: "贷款" as const,
          matchReason: "客户在他行有贷款，我行利率更优，可为您提供置换方案节省利息。",
          expectedRate: "LPR + 50bp",
        },
      ]
    : [
        {
          productCode: "LOAN-OP-EQUIP",
          productName: "经营设备贷",
          category: "贷款" as const,
          matchReason: `近 90 天上游采购流水 ¥${(cashflowAnalysis.upstream.reduce((s, u) => s + u.amount, 0) / 10000).toFixed(0)}万，疑似设备升级需求。`,
          expectedRate: "4.85%",
        },
      ]

  return {
    customer,
    visitRecords: fallbackVisits,
    depositRecommendation: depositRec,
    loanRecommendation: loanRec,
    riskSignals,
    admissionResult,
    cashflowAnalysis,
    generatedReport,
  }
}

function buildReportText(name: string, customer: Customer, conclusion: string) {
  return `# 贷前调查报告 · ${name}

## 一、基础信息
- 姓名：${name}
- 身份证：${customer.idNoMasked}
- 联系方式：${customer.phoneMasked}
- 居住地址：${customer.address}
- 网格 / 支行：${customer.grid} / ${customer.branch}
- 客户经理：${customer.managerName}

## 二、资产与负债
- 我行日均存款：¥${customer.avgDeposit.toLocaleString()}
- 我行抵押贷款余额：¥${customer.mortgageLoan.toLocaleString()}
- 我行信用贷款余额：¥${customer.creditLoan.toLocaleString()}
- 是否有效合同：${customer.hasValidContract ? "是" : "否"}
- 当前用信金额：¥${customer.usedCreditAmount.toLocaleString()}
- 他行是否有贷：${customer.hasOtherBankLoan ? "是" : "否"}

## 三、经营与上下游
近 6 个月主营业务现金流呈持续上升趋势，月均净流入 ¥1,460,000，上游集中度可控，下游客户分布在新能源、出口代理、工业品渠道三个赛道。

## 四、风险信号
- 征信查询：近 6 个月外部查询次数偏多
- 流水：流水稳定，反洗钱无触发
- 司法：未发现涉诉

## 五、准入结论
${conclusion}

> 报告由 AI 客户经营助手生成，字段引用自核心系统、征信平台与反洗钱监测平台，需客户经理人工复核后方可作为业务凭据。
`
}
