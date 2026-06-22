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
]
