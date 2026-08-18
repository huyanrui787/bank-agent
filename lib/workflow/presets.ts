import type { WorkflowDefinition } from "./types"

export type PresetWorkflow = {
  name: string
  description: string
  definition: WorkflowDefinition
}

export const PRESET_WORKFLOWS: PresetWorkflow[] = [
  {
    name: "高净值客户筛选",
    description: "筛选日均存款大于 10 万的客户，并用 LLM 生成经营摘要。",
    definition: {
      nodes: [
        { id: "start", type: "start", position: { x: 80, y: 200 }, data: { label: "开始" } },
        {
          id: "filter",
          type: "tool",
          position: { x: 280, y: 200 },
          data: {
            label: "筛选客户",
            toolName: "filterCustomers",
            toolArgs: { minAvgDeposit: 100000, limit: 30 },
            outputVar: "customers",
          },
        },
        {
          id: "summarize",
          type: "llm",
          position: { x: 520, y: 200 },
          data: {
            label: "生成摘要",
            systemPrompt: "你是银行客户经理助手，用中文简洁总结筛选结果与跟进建议。",
            userTemplate: "以下是筛选到的客户数据，请总结重点与下一步行动：\n{{customers}}",
            outputVar: "summary",
          },
        },
        { id: "end", type: "end", position: { x: 760, y: 200 }, data: { label: "结束" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "filter" },
        { id: "e2", source: "filter", target: "summarize" },
        { id: "e3", source: "summarize", target: "end" },
      ],
    },
  },
  {
    name: "业务预警扫描",
    description: "扫描 critical 级别预警，并生成联系话术建议。",
    definition: {
      nodes: [
        { id: "start", type: "start", position: { x: 80, y: 200 }, data: { label: "开始" } },
        {
          id: "alerts",
          type: "tool",
          position: { x: 280, y: 200 },
          data: {
            label: "扫描预警",
            toolName: "scanAlerts",
            toolArgs: { severity: "critical", status: "pending" },
            outputVar: "alerts",
          },
        },
        {
          id: "script",
          type: "llm",
          position: { x: 520, y: 200 },
          data: {
            label: "话术建议",
            systemPrompt: "你是银行客户经理，根据预警信息生成简短、合规的联系话术。",
            userTemplate: "预警列表：\n{{alerts}}\n\n请为每条预警给出 1-2 句联系话术。",
            skillId: "marketing-fabe",
            outputVar: "scripts",
          },
        },
        { id: "end", type: "end", position: { x: 760, y: 200 }, data: { label: "结束" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "alerts" },
        { id: "e2", source: "alerts", target: "script" },
        { id: "e3", source: "script", target: "end" },
      ],
    },
  },
  {
    name: "存贷数据洞察",
    description: "用 CodeAct 查询 SQLite 并输出客户经理存贷分布图表。",
    definition: {
      nodes: [
        { id: "start", type: "start", position: { x: 80, y: 200 }, data: { label: "开始" } },
        {
          id: "code",
          type: "codeact",
          position: { x: 320, y: 200 },
          data: {
            label: "统计分析",
            code: `import json
rows = query("SELECT manager_name, SUM(avg_deposit) as deposit, SUM(mortgage_loan+credit_loan) as loan FROM customers GROUP BY manager_name ORDER BY deposit DESC LIMIT 8")
data = [{"name": r["manager_name"], "deposit": round(r["deposit"]/10000, 1), "loan": round(r["loan"]/10000, 1)} for r in rows]
chart = {"type":"bar","title":"客户经理存贷分布（万元）","data":data,"xKey":"name","yKeys":[{"key":"deposit","label":"存款","color":"#1e40af"},{"key":"loan","label":"贷款","color":"#059669"}]}
print('<<<CHART:' + json.dumps(chart) + '>>>')
for r in data:
    print(f"{r['name']}: 存款 {r['deposit']} 万, 贷款 {r['loan']} 万")`,
            outputVar: "stats",
          },
        },
        { id: "end", type: "end", position: { x: 560, y: 200 }, data: { label: "结束" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "code" },
        { id: "e2", source: "code", target: "end" },
      ],
    },
  },

  // ── 副本新增的 4 个预置工作流 ──
  {
    name: "筛客 → 风险分析 → 话术生成",
    description: "筛选目标客户，逐一分析风险并生成联系话术，供客户经理直接使用。",
    definition: {
      nodes: [
        { id: "start", type: "start", position: { x: 80, y: 200 }, data: { label: "开始" } },
        {
          id: "filter", type: "tool", position: { x: 340, y: 200 },
          data: {
            label: "筛选客户",
            toolName: "filterCustomers",
            toolArgs: { minAvgDeposit: 100000 },
            outputVar: "filtered",
          },
        },
        {
          id: "analyze", type: "llm", position: { x: 600, y: 200 },
          data: {
            label: "风险分析",
            systemPrompt: "你是银行风控专家，请基于以下客户数据分析风险情况，给出简明结论。",
            userTemplate: "客户数据：{{filtered}}",
            outputVar: "riskReport",
          },
        },
        {
          id: "script", type: "tool", position: { x: 860, y: 200 },
          data: {
            label: "生成话术",
            toolName: "generateScript",
            toolArgs: { context: "{{riskReport}}" },
            outputVar: "output",
          },
        },
        { id: "end", type: "end", position: { x: 1120, y: 200 }, data: { label: "结束" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "filter" },
        { id: "e2", source: "filter", target: "analyze" },
        { id: "e3", source: "analyze", target: "script" },
        { id: "e4", source: "script", target: "end" },
      ],
    },
  },
  {
    name: "预警扫描 → 条件分支 → 分级处理",
    description: "扫描业务预警，按风险等级判断是否触发高优先级处理流程。",
    definition: {
      nodes: [
        { id: "start", type: "start", position: { x: 80, y: 200 } , data: { label: "开始" } },
        {
          id: "scan", type: "tool", position: { x: 320, y: 200 },
          data: { label: "扫描预警", toolName: "scanAlerts", toolArgs: {}, outputVar: "alerts" },
        },
        {
          id: "cond", type: "condition", position: { x: 580, y: 200 },
          data: { label: "是否高风险", expression: "\"{{alerts}}\".includes(\"高风险\")" },
        },
        {
          id: "highRisk", type: "llm", position: { x: 840, y: 100 },
          data: {
            label: "高优先级处理建议",
            systemPrompt: "你是支行风险合规负责人，请给出高优先级预警的处理建议。",
            userTemplate: "预警信息：{{alerts}}",
            outputVar: "output",
          },
        },
        {
          id: "normal", type: "llm", position: { x: 840, y: 300 },
          data: {
            label: "常规处理建议",
            systemPrompt: "你是客户经理助手，请给出常规预警的跟进建议。",
            userTemplate: "预警信息：{{alerts}}",
            outputVar: "output",
          },
        },
        { id: "end", type: "end", position: { x: 1100, y: 200 }, data: { label: "结束" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "scan" },
        { id: "e2", source: "scan", target: "cond" },
        { id: "e3", source: "cond", target: "highRisk", sourceHandle: "true", label: "高风险" },
        { id: "e4", source: "cond", target: "normal", sourceHandle: "false", label: "常规" },
        { id: "e5", source: "highRisk", target: "end" },
        { id: "e6", source: "normal", target: "end" },
      ],
    },
  },
  {
    name: "客户画像 → 调查报告",
    description: "对单一客户完成 360° 画像分析，并自动生成贷前调查报告。",
    definition: {
      nodes: [
        { id: "start", type: "start", position: { x: 80, y: 200 }, data: { label: "开始" } },
        {
          id: "profile", type: "tool", position: { x: 340, y: 200 },
          data: {
            label: "客户画像分析",
            toolName: "analyzeCustomer",
            toolArgs: { customerName: "{{input}}" },
            outputVar: "profile",
          },
        },
        {
          id: "report", type: "tool", position: { x: 600, y: 200 },
          data: {
            label: "生成调查报告",
            toolName: "generateInvestigationReport",
            toolArgs: { customerName: "{{input}}" },
            outputVar: "output",
          },
        },
        { id: "end", type: "end", position: { x: 860, y: 200 }, data: { label: "结束" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "profile" },
        { id: "e2", source: "profile", target: "report" },
        { id: "e3", source: "report", target: "end" },
      ],
    },
  },
  {
    name: "存贷比分析 → 合规审查",
    description: "使用 CodeAct 计算存贷比等衍生指标，再用合规视角复核结论。",
    definition: {
      nodes: [
        { id: "start", type: "start", position: { x: 80, y: 200 }, data: { label: "开始" } },
        {
          id: "calc", type: "codeact", position: { x: 340, y: 200 },
          data: {
            label: "计算存贷比",
            code:
              'rows = query("SELECT branch, SUM(avg_deposit) as deposit FROM customers GROUP BY branch")\nfor r in rows:\n    print(r["branch"], r["deposit"])',
            outputVar: "calcResult",
          },
        },
        {
          id: "review", type: "skill", position: { x: 600, y: 200 },
          data: { label: "合规审查", skillId: "compliance-reviewer", outputVar: "output" },
        },
        { id: "end", type: "end", position: { x: 860, y: 200 }, data: { label: "结束" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "calc" },
        { id: "e2", source: "calc", target: "review" },
        { id: "e3", source: "review", target: "end" },
      ],
    },
  },
]
