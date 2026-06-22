// 准入规则库：6 类规则匹配
import type { Customer } from "./types"

export type AdmissionRuleCategory =
  | "blacklist"
  | "restricted"
  | "intermediary"
  | "internal"
  | "external"
  | "databao"

export type AdmissionRuleStatus = "pass" | "hit" | "unknown"

export type AdmissionRuleDetail = {
  category: AdmissionRuleCategory
  categoryLabel: string
  status: AdmissionRuleStatus
  rules: {
    code: string
    name: string
    status: AdmissionRuleStatus
    detail: string
    source: string
  }[]
  summary: string
}

export function checkAdmissionRules(customer: Customer): AdmissionRuleDetail[] {
  const isHighRisk = customer.riskLevel === "high"
  const hasOtherLoan = customer.hasOtherBankLoan

  return [
    {
      category: "blacklist",
      categoryLabel: "黑名单",
      status: isHighRisk ? "hit" : "pass",
      rules: [
        {
          code: "BL-01",
          name: "法院失信被执行人",
          status: isHighRisk ? "hit" : "pass",
          detail: isHighRisk
            ? "客户被列入法院失信被执行人名单，案号：（2025）陕 0113 执 4821 号"
            : "未发现失信被执行记录",
          source: "最高人民法院失信被执行人名单库 / 实时",
        },
        {
          code: "BL-02",
          name: "人行征信 D 类记录",
          status: isHighRisk ? "hit" : "pass",
          detail: isHighRisk
            ? "征信报告存在 D 类不良记录，近 2 年连续逾期 3 次以上"
            : "征信报告无 D 类记录，信用状况良好",
          source: "中国人民银行征信系统 / 2026-05-20",
        },
        {
          code: "BL-03",
          name: "反洗钱重点监控",
          status: "pass",
          detail: "未列入反洗钱重点监控名单",
          source: "反洗钱监测平台 / 实时",
        },
      ],
      summary: isHighRisk
        ? "命中黑名单，不得准入，需上报合规部门处理"
        : "黑名单核查通过，无不良记录",
    },
    {
      category: "restricted",
      categoryLabel: "限入名单",
      status: hasOtherLoan ? "hit" : "pass",
      rules: [
        {
          code: "RI-01",
          name: "多头借贷风险",
          status: hasOtherLoan ? "hit" : "pass",
          detail: hasOtherLoan
            ? "客户在他行存在贷款余额，多头授信风险需关注，需经支行行长审批"
            : "无多头借贷记录",
          source: "人行征信报告 / 2026-05-20",
        },
        {
          code: "RI-02",
          name: "行业限制",
          status: "pass",
          detail: "客户所在行业不在限制准入名单内",
          source: "《行业信贷政策指引》2026 年版",
        },
        {
          code: "RI-03",
          name: "经营异常",
          status: "pass",
          detail: "工商系统未显示经营异常状态",
          source: "国家企业信用信息公示系统 / 2026-05-18",
        },
      ],
      summary: hasOtherLoan
        ? "存在多头借贷风险，需支行行长审批后方可准入"
        : "限入名单核查通过",
    },
    {
      category: "intermediary",
      categoryLabel: "中介名单",
      status: "pass",
      rules: [
        {
          code: "IM-01",
          name: "贷款中介机构",
          status: "pass",
          detail: "未发现与已知贷款中介机构的关联",
          source: "内部中介机构黑名单库 / 2026-05",
        },
        {
          code: "IM-02",
          name: "异常推荐渠道",
          status: "pass",
          detail: "客户来源渠道正常，非中介推荐",
          source: "CRM 系统 / 客户来源记录",
        },
      ],
      summary: "中介名单核查通过，客户来源渠道正常",
    },
    {
      category: "internal",
      categoryLabel: "行内准入",
      status: customer.hasValidContract ? "pass" : "unknown",
      rules: [
        {
          code: "IN-01",
          name: "本行历史信用记录",
          status: customer.hasValidContract ? "pass" : "unknown",
          detail: customer.hasValidContract
            ? "本行历史贷款记录良好，无逾期"
            : "客户为新客户，暂无本行历史记录",
          source: "本行核心系统 / 实时",
        },
        {
          code: "IN-02",
          name: "存款关系",
          status: customer.avgDeposit > 50000 ? "pass" : "unknown",
          detail:
            customer.avgDeposit > 50000
              ? `日均存款 ¥${customer.avgDeposit.toLocaleString()}，存款关系稳定`
              : "存款余额偏低，建议先建立存款关系",
          source: "本行核心系统 / 实时",
        },
        {
          code: "IN-03",
          name: "授信集中度",
          status: customer.mortgageLoan / Math.max(customer.avgDeposit, 1) < 6 ? "pass" : "hit",
          detail:
            customer.mortgageLoan / Math.max(customer.avgDeposit, 1) < 6
              ? "授信集中度在合理范围内"
              : "授信集中度偏高，需关注",
          source: "本行核心系统 / 实时",
        },
      ],
      summary:
        customer.hasValidContract
          ? "行内准入核查通过，历史记录良好"
          : "新客户，行内记录待建立，建议加强贷后管理",
    },
    {
      category: "external",
      categoryLabel: "行外准入",
      status: isHighRisk ? "hit" : "pass",
      rules: [
        {
          code: "EX-01",
          name: "他行征信查询频次",
          status: isHighRisk ? "hit" : "pass",
          detail: isHighRisk
            ? "近 6 个月他行征信查询 8 次，频次异常，疑似多头借贷"
            : `近 6 个月征信查询 ${4 + (customer.id.charCodeAt(2) % 3)} 次，频次正常`,
          source: "人行征信系统 / 2026-05-20",
        },
        {
          code: "EX-02",
          name: "他行贷款余额",
          status: hasOtherLoan ? "hit" : "pass",
          detail: hasOtherLoan
            ? "在他行存在贷款余额，需合并计算授信额度"
            : "无他行贷款记录",
          source: "人行征信系统 / 2026-05-20",
        },
      ],
      summary: isHighRisk
        ? "行外征信存在风险信号，需人工复核"
        : "行外准入核查通过",
    },
    {
      category: "databao",
      categoryLabel: "数据宝",
      status: "pass",
      rules: [
        {
          code: "DB-01",
          name: "司法涉诉查询",
          status: isHighRisk ? "hit" : "pass",
          detail: isHighRisk
            ? "发现 1 条民事诉讼记录，案由：合同纠纷，状态：审理中"
            : "未发现司法涉诉记录",
          source: "数据宝·司法数据 / 2026-05-21",
        },
        {
          code: "DB-02",
          name: "工商经营状态",
          status: "pass",
          detail: "工商注册状态正常，经营年限 3 年以上",
          source: "数据宝·工商数据 / 2026-05-21",
        },
        {
          code: "DB-03",
          name: "税务信用评级",
          status: "pass",
          detail: "税务信用评级 B 级，近 2 年无重大税务违规",
          source: "数据宝·税务数据 / 2026-05-21",
        },
      ],
      summary: isHighRisk
        ? "数据宝查询发现司法涉诉记录，需进一步核实"
        : "数据宝核查通过，经营状态正常",
    },
  ]
}
