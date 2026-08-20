/**
 * Agent 可调用的工具。每个工具：
 *  1. 声明 JSON Schema（暴露给 LLM）
 *  2. 提供 execute()：在 Demo 环境里查 Mock 数据并返回一个稳定结构
 *  3. 通过 toAgentResult() 把"工具最近一次输出"映射到当前 UI 期望的 resultType + data
 *
 * 这样保证：模型只决定意图与参数，结果数据始终来自本地确定性 Mock，演示稳定可控。
 */

import { getDb } from "@/lib/db"
import { getBusinessDataSource } from "@/lib/datasource"
import type { DataScope } from "@/lib/auth/scope"
import { buildProfile } from "@/lib/agent/mock-tools"
import { generateScript } from "@/lib/mock/scripts"
import { redactForLlm } from "@/lib/auth/desensitize"
import { decryptSecret } from "@/lib/security/encrypt"
import { buildSchemaPrompt } from "@/lib/db/schema-info"
import { writeAuditLog } from "@/lib/audit/log"
import type { ToolDef } from "@/lib/agent/llm"
import type { AgentResultType } from "@/lib/agent/types"
import type { AgentCtx } from "@/lib/agent/llm-agent"
import type { CustomerProfile } from "@/lib/mock/types"

export type ToolExecuteResult = {
  textForModel: string
  ui: {
    resultType: AgentResultType
    data: unknown
  } | null
}

export type ToolHandler = (args: Record<string, unknown>, ctx?: AgentCtx) => ToolExecuteResult | Promise<ToolExecuteResult>

export const toolDefs: ToolDef[] = [
  {
    type: "function",
    name: "filterCustomers",
    description:
      "按多维条件筛选客户清单。**只传用户明确提及的参数**，未提及的字段一律省略。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        community: { type: "string", description: "小区/网格关键词；用户提到具体小区或网格时才传" },
        minAvgDeposit: { type: "number", description: "日均存款最低值（元）；用户提到金额时才传" },
        hasOtherBankLoan: {
          type: "boolean",
          description: "仅当用户提到\"他行有贷 / 无贷有贷\"时设为 true。**未提及就不要传**",
        },
        hasValidContract: {
          type: "boolean",
          description: "仅当用户提到\"有效合同\"时设为 true。**未提及就不要传**",
        },
        unusedCredit: {
          type: "boolean",
          description: "仅当用户提到\"未用信 / 用信为 0\"时设为 true。**未提及就不要传**",
        },
        limit: { type: "number", description: "返回前 N 条，默认 30，最大 80" },
      },
    },
  },
  {
    type: "function",
    name: "getManagerPerformance",
    description: "返回所有客户经理的本月新增客户、新增存贷、维护得分与环比变化。",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    type: "function",
    name: "scanAlerts",
    description: "扫描业务预警；可按类型 / 严重度 / 状态过滤。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        severity: { type: "string", enum: ["info", "warning", "critical"] },
        types: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "deposit_due",
              "loan_due",
              "financing_growth",
              "financing_surge",
              "new_property",
              "grid_change",
              "branch_abnormal",
            ],
          },
        },
        status: { type: "string", enum: ["pending", "processing", "done"] },
        limit: { type: "number" },
      },
    },
  },
  {
    type: "function",
    name: "analyzeCustomer",
    description:
      "为单个客户产出 360° 画像（基础信息 / 风险信号 / 准入 / 上下游流水 / 产品推荐）。",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description: "客户姓名、客户编号(C001 等)、身份证号片段、手机号片段或地址关键词",
        },
      },
    },
  },
  {
    type: "function",
    name: "generateInvestigationReport",
    description: "为指定客户生成贷前调查报告（Markdown），可复制 / 导出。",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", description: "客户姓名或编号" },
      },
    },
  },
  {
    type: "function",
    name: "exportData",
    description:
      "把指定数据集导出为 Excel(.xlsx) 或 CSV。**用户提到 Excel/xlsx/电子表格 时使用 xlsx；提到 CSV 时使用 csv；未明确时默认 xlsx**。",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: {
          type: "string",
          enum: ["customers", "managers", "alerts"],
          description: "客户清单 / 客户经理绩效 / 业务预警",
        },
        format: {
          type: "string",
          enum: ["xlsx", "csv"],
          description: "导出文件格式，默认 xlsx",
        },
      },
    },
  },
  {
    type: "function",
    name: "generateScript",
    description: "根据客户五级分类（正常/关注/次级/可疑/损失）生成个性化营销或催收话术。",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", description: "客户姓名或编号" },
        scene: {
          type: "string",
          enum: ["营销", "催收", "续存", "转介绍"],
          description: "话术场景，默认营销",
        },
      },
    },
  },
  {
    type: "function",
    name: "queryDatabase",
    description: "自动选取数据库表进行查询，无需用户指定表名，根据语义自动判断。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        table: {
          type: "string",
          enum: ["customers", "managers", "alerts", "products", "visits"],
          description: "目标数据表，根据用户意图自动选择",
        },
        limit: { type: "number", description: "返回条数，默认 20，最大 50" },
      },
    },
  },
  {
    type: "function",
    name: "codeActAnalysis",
    description:
      "当用户需要：1)自定义多步数据分析 2)生成图表（折线/柱状/饼图）3)计算复合指标/衍生指标（如存贷比、人均贡献、环比增速）4)跨表聚合或自由 SQL 查询时使用。**你必须直接编写完整的 Python 代码**，通过 code 参数提交给执行引擎。普通筛选/预警/画像请用专用工具。若用户指定了外部数据库，传入 datasourceId 参数。",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["code"],
      properties: {
        code: {
          type: "string",
          description: `完整 Python 代码，可直接使用以下内置函数（沙箱只含 Python 标准库，**严禁 import pandas/numpy/matplotlib 等第三方库**）：
- query(sql, params=None) → list[dict]   执行 SQL，返回字典列表
- query_one(sql, params=None) → dict     查询单行
- show_table(rows, max_rows=20)          以 Markdown 表格打印查询结果
- emit_chart(chart_type, title, data, x_key, y_keys)  输出图表，chart_type='bar'|'line'|'pie'|'treemap'

【重要】当前数据源的真实表结构与字段名见 System Prompt 末尾的「数据字典」。写 SQL 必须用字典里的真实表名/字段名，禁止臆造。若字典为空，回退使用默认库 bank.db（customers/managers/alerts/visits/products）。若用户指定外部数据库，传入 datasourceId。
金额单位：元，显示时除以 10000 转为"万"。

示例（按客户经理统计日均存款并出柱状图）：
rows = query("SELECT manager_name AS name, ROUND(SUM(avg_deposit)/10000,1) AS dep FROM customers GROUP BY manager_name ORDER BY dep DESC")
show_table(rows)
emit_chart("bar", "各经理日均存款（万）", rows, "name", [{"key": "dep", "label": "日均存款(万)", "color": "#1e40af"}])`,
        },
        datasourceId: {
          type: "string",
          description: "（可选）外部数据源 ID。不填则使用默认 SQLite。填写后 query() 将连接到该数据源。",
        },
      },
    },
  },
]

export type ChartSpec = {
  type: "bar" | "line" | "pie" | "treemap"
  title: string
  data: { name: string; [key: string]: unknown }[]
  xKey: string
  yKeys: { key: string; label: string; color?: string }[]
}

function buildAnalysisCode(task: string): string {
  const escaped = task.replace(/\\/g, "\\\\").replace(/"""/g, "'''").slice(0, 500)
  return `import json

task = """${escaped}"""
task_lower = task.lower()

def emit_chart(chart_type, title, data, x_key, y_keys):
    obj = {"type": chart_type, "title": title, "data": data, "xKey": x_key, "yKeys": y_keys}
    print("<<<CHART:" + json.dumps(obj, ensure_ascii=False) + ">>>")

if any(k in task_lower for k in ["存贷比", "贷存比"]):
    rows = query("""SELECT manager_name,
        ROUND(SUM(mortgage_loan+credit_loan)*1.0/NULLIF(SUM(avg_deposit),0)*100,1) AS ratio,
        ROUND(SUM(avg_deposit)/10000,1) AS dep, ROUND(SUM(mortgage_loan+credit_loan)/10000,1) AS loan
        FROM customers GROUP BY manager_name ORDER BY ratio DESC""")
    print("存贷比分析（按客户经理）：")
    for r in rows: print(f"  {r['manager_name']}: 存款{r['dep']}万 贷款{r['loan']}万 存贷比{r['ratio']}%")
    emit_chart("bar","各经理存贷比（%）",rows,"manager_name",[{"key":"ratio","label":"存贷比(%)","color":"#dc2626"}])

elif any(k in task_lower for k in ["网格","小区"]) and any(k in task_lower for k in ["存款","日均"]):
    rows = query("""SELECT grid, COUNT(*) AS cnt, ROUND(AVG(avg_deposit)/10000,1) AS avg_dep,
        ROUND(SUM(avg_deposit)/10000,1) AS total_dep FROM customers GROUP BY grid ORDER BY avg_dep DESC LIMIT 15""")
    print("各网格平均日均存款：")
    for i,r in enumerate(rows,1): print(f"  {i}. {r['grid']}: 均{r['avg_dep']}万 合计{r['total_dep']}万 {r['cnt']}户")
    emit_chart("bar","各网格平均日均存款（万）",rows,"grid",[{"key":"avg_dep","label":"均日存款(万)","color":"#1e40af"}])

elif any(k in task_lower for k in ["经理","绩效","排名"]) and any(k in task_lower for k in ["存款","deposit"]):
    rows = query("""SELECT manager_name, ROUND(SUM(avg_deposit)/10000,1) AS dep, COUNT(*) AS cnt
        FROM customers GROUP BY manager_name ORDER BY dep DESC LIMIT 10""")
    print("各经理名下客户日均存款：")
    for r in rows: print(f"  {r['manager_name']}: {r['dep']}万 ({r['cnt']}户)")
    emit_chart("bar","各经理日均存款合计（万）",rows,"manager_name",
        [{"key":"dep","label":"日均存款(万)","color":"#1e40af"},{"key":"cnt","label":"客户数","color":"#16a34a"}])

elif any(k in task_lower for k in ["预警","alert"]):
    rows = query("""SELECT severity, COUNT(*) AS cnt FROM alerts GROUP BY severity
        ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END""")
    labels = {"critical":"紧急","warning":"警告","info":"提示"}
    print("预警分布：")
    for r in rows: print(f"  {labels.get(r['severity'],r['severity'])}: {r['cnt']}条")
    data = [{"name":labels.get(r["severity"],r["severity"]),"value":r["cnt"]} for r in rows]
    emit_chart("pie","预警严重度分布",data,"name",[{"key":"value","label":"数量","color":"#dc2626"}])

elif any(k in task_lower for k in ["风险","risk","等级"]):
    rows = query("""SELECT risk_level, COUNT(*) AS cnt, ROUND(AVG(avg_deposit)/10000,1) AS avg_dep
        FROM customers GROUP BY risk_level ORDER BY cnt DESC""")
    print("客户风险等级分布：")
    for r in rows: print(f"  {r['risk_level']}: {r['cnt']}户 均日存{r['avg_dep']}万")
    emit_chart("bar","客户风险等级分布",rows,"risk_level",
        [{"key":"cnt","label":"客户数","color":"#1e40af"},{"key":"avg_dep","label":"均日存款(万)","color":"#16a34a"}])

elif any(k in task_lower for k in ["客群","分类","segment"]):
    rows = query("""SELECT segment, COUNT(*) AS cnt, ROUND(SUM(avg_deposit)/10000,1) AS total_dep
        FROM customers GROUP BY segment ORDER BY total_dep DESC""")
    print("客群分布：")
    for r in rows: print(f"  {r['segment']}: {r['cnt']}户 合计{r['total_dep']}万")
    emit_chart("pie","客群分布（按客户数）",rows,"segment",[{"key":"cnt","label":"客户数","color":"#1e40af"}])

else:
    s = query_one("""SELECT COUNT(*) AS n, ROUND(SUM(avg_deposit)/10000,1) AS dep,
        ROUND(AVG(avg_deposit)/10000,2) AS avg_dep, ROUND(SUM(mortgage_loan+credit_loan)/10000,1) AS loan
        FROM customers""")
    mgr = query_one("SELECT COUNT(*) AS n FROM managers")
    alr = query_one("SELECT COUNT(*) AS n FROM alerts WHERE status='pending'")
    print(f"数据概况：客户{s['n']}户 日均存款合计{s['dep']}万 人均{s['avg_dep']}万 贷款{s['loan']}万")
    print(f"客户经理{mgr['n']}人 待处理预警{alr['n']}条")
    print(f"\\n提示：任务 \\"{task}\\" 未匹配预置模板。可尝试：按经理汇总存款画柱状图、计算各网格存贷比、分析预警分布等。")
`
}

const BANK_SCOPE: DataScope = { type: "bank", customer: null, manager: null, alert: null, label: "全行" }

export const toolHandlers: Record<string, ToolHandler> = {
  filterCustomers(args, ctx) {
    const ds = getBusinessDataSource(ctx?.datasourceId)
    const scope = ctx?.scope ?? BANK_SCOPE
    const conditions: string[] = []
    const filter = {
      community: typeof args.community === "string" && args.community.trim() ? args.community.trim() : undefined,
      minAvgDeposit: typeof args.minAvgDeposit === "number" ? args.minAvgDeposit : undefined,
      hasOtherBankLoan: args.hasOtherBankLoan === true ? true : undefined,
      hasValidContract: args.hasValidContract === true ? true : undefined,
      unusedCredit: args.unusedCredit === true ? true : undefined,
    }
    if (filter.community) conditions.push(`社区/网格 包含 "${filter.community}"`)
    if (typeof filter.minAvgDeposit === "number") conditions.push(`日均存款 >= ${filter.minAvgDeposit.toLocaleString()} 元`)
    if (filter.hasOtherBankLoan) conditions.push("本行无贷·他行有贷")
    if (filter.hasValidContract) conditions.push("有效合同")
    if (filter.unusedCredit) conditions.push("当前用信 = 0")

    const limit = Math.max(1, Math.min(80, Number(args.limit ?? 30)))
    const list = ds.filterCustomers(filter, scope, ctx?.user?.role, limit)

    return {
      textForModel: `从数据库查询到 ${list.length} 位客户（条件：${conditions.join("、") || "无"}）。前几位：${list.slice(0, 5).map((c) => `${c.name}(${c.id}, 日均${(c.avgDeposit / 10000).toFixed(1)}万, 经理${c.managerName})`).join("；")}`,
      ui: { resultType: "table" as const, data: list },
    }
  },

  getManagerPerformance(_args, ctx) {
    const ds = getBusinessDataSource(ctx?.datasourceId)
    const scope = ctx?.scope ?? BANK_SCOPE
    const list = ds.getManagers(scope)
    const totalNewCustomers = list.reduce((s, m) => s + m.monthlyNewCustomers, 0)
    return {
      textForModel: `数据库中共 ${list.length} 位客户经理，本月合计新增客户 ${totalNewCustomers} 户。Top3 存款新增：${list.slice(0, 3).map((m) => `${m.name}(${(m.monthlyDepositIncrease / 10000).toFixed(0)}万, 环比${m.vsLastMonthDeposit >= 0 ? "+" : ""}${m.vsLastMonthDeposit}%)`).join("，")}`,
      ui: { resultType: "table" as const, data: list },
    }
  },

  scanAlerts(args, ctx) {
    const ds = getBusinessDataSource(ctx?.datasourceId)
    const scope = ctx?.scope ?? BANK_SCOPE
    const filter = {
      severity: typeof args.severity === "string" ? (args.severity as "info" | "warning" | "critical") : undefined,
      types: Array.isArray(args.types) && args.types.length > 0 ? (args.types as string[]) : undefined,
      status: typeof args.status === "string" ? (args.status as "pending" | "processing" | "done") : undefined,
    }
    const limit = Math.max(1, Math.min(50, Number(args.limit ?? 50)))
    const list = ds.scanAlerts(filter, scope, limit)
    const criticalCount = list.filter((a) => a.severity === "critical").length

    return {
      textForModel: `数据库中命中 ${list.length} 条预警，其中紧急 ${criticalCount} 条。摘要：${list.slice(0, 4).map((a) => `[${a.severity}] ${a.title}${a.customerName ? "·" + a.customerName : ""}`).join("；")}`,
      ui: { resultType: "alert", data: list },
    }
  },

  analyzeCustomer(args, ctx) {
    const ds = getBusinessDataSource(ctx?.datasourceId)
    const q = String(args.query ?? "").trim()
    const scope = ctx?.scope ?? BANK_SCOPE
    const customer = ds.getCustomer(q, scope, ctx?.user?.role)

    if (!customer) {
      return { textForModel: `未在你的数据权限范围内找到客户「${q}」，请确认姓名/编号是否正确。`, ui: null }
    }
    const profile: CustomerProfile = buildProfile(customer)
    const redacted = redactForLlm(customer)

    return {
      textForModel: `客户 ${redacted.name ?? customer.name}（${customer.id}）画像已从数据库生成：日均存款 ${(customer.avgDeposit / 10000).toFixed(1)}万、风险等级 ${customer.riskLevel}、风险信号 ${profile.riskSignals.length} 条、准入结论：${profile.admissionResult.passed ? "通过" : "需审核"}。`,
      ui: { resultType: "profile", data: profile },
    }
  },

  generateInvestigationReport(args, ctx) {
    const ds = getBusinessDataSource(ctx?.datasourceId)
    const q = String(args.query ?? "").trim()
    const scope = ctx?.scope ?? BANK_SCOPE
    const customer = ds.getCustomer(q, scope, ctx?.user?.role)

    if (!customer) {
      return { textForModel: `未在你的数据权限范围内找到客户「${q}」，无法生成调查报告。`, ui: null }
    }
    const profile = buildProfile(customer)

    return {
      textForModel: `调查报告已从数据库生成，长度 ${profile.generatedReport.length} 字，覆盖基础/经营/风险/结论四段。`,
      ui: { resultType: "report", data: profile },
    }
  },

  exportData(args) {
    const type = (args.type as string) ?? "customers"
    const format = ((args.format as string) ?? "xlsx") === "csv" ? "csv" : "xlsx"
    const ext = format === "xlsx" ? "xlsx" : "csv"
    const filename = `${type}.${ext}`
    const url = `/api/export?type=${type}&format=${format}`
    const friendly = format === "xlsx" ? "Excel(.xlsx)" : "CSV(.csv, UTF-8 BOM)"
    return {
      textForModel: `已准备 ${type} 的 ${friendly} 导出文件 ${filename}，数据来自 SQLite 数据库，前端可点击下载链接获取。`,
      ui: { resultType: "file", data: { url, filename, format } },
    }
  },

  generateScript(args, ctx) {
    const ds = getBusinessDataSource(ctx?.datasourceId)
    const q = String(args.query ?? "").trim()
    const scene = String(args.scene ?? "营销")
    const scope = ctx?.scope ?? BANK_SCOPE
    const customer = ds.getCustomer(q, scope, ctx?.user?.role)

    if (!customer) {
      return { textForModel: `未在你的数据权限范围内找到客户「${q}」，无法生成话术。`, ui: null }
    }
    const result = generateScript(customer, scene)
    const scriptContent = `# ${result.title}\n\n**客户等级：** ${result.grade}类  **场景：** ${result.scene}  **渠道：** ${result.channel}\n\n---\n\n${result.content}\n\n---\n\n**使用建议：**\n${result.tips.map((t) => `- ${t}`).join("\n")}`
    const profile = buildProfile(customer)

    return {
      textForModel: `已为 ${customer.name}（${result.grade}类客户）生成${result.scene}话术，渠道：${result.channel}。`,
      ui: { resultType: "report", data: { ...profile, generatedReport: scriptContent } },
    }
  },

  queryDatabase(args, ctx) {
    const ds = getBusinessDataSource(ctx?.datasourceId)
    const scope = ctx?.scope ?? BANK_SCOPE
    const table = String(args.table ?? "customers")
    const limit = Math.max(1, Math.min(50, Number(args.limit ?? 20)))

    let data: unknown[]
    let label: string
    if (table === "managers") {
      data = ds.getManagers(scope)
      label = "客户经理"
    } else if (table === "alerts") {
      data = ds.scanAlerts({}, scope, limit)
      label = "预警"
    } else if (table === "visits") {
      data = ds.getVisits()
      label = "走访记录"
    } else if (table === "products") {
      data = ds.getProducts()
      label = "产品"
    } else {
      data = ds.filterCustomers({}, scope, ctx?.user?.role, limit)
      label = "客户"
    }
    return {
      textForModel: `已从数据库 ${table} 表查询到 ${data.length} 条${label}记录。`,
      ui: { resultType: "table" as const, data },
    }
  },

  async codeActAnalysis(args, ctx) {
    // LLM writes Python directly via `code`; `task` kept for backward-compat fallback
    const code = String(args.code ?? "").trim() || buildAnalysisCode(String(args.task ?? ""))
    if (!code) return { textForModel: "代码为空，无法执行分析。", ui: null }

    const scope = ctx?.scope
      ? { type: ctx.scope.type, managerName: ctx.user?.name, branch: ctx.user?.branch }
      : undefined

    // Resolve external datasource if requested
    let datasource: Record<string, unknown> | undefined
    const dsId = String(args.datasourceId ?? "").trim()
      || (ctx?.schema && ctx.schema.source !== "default" ? ctx.schema.source : "")
    if (dsId) {
      // 外部数据源执行仅限分行管理员：防止客户经理/支行长借 codeAct 绕过数据范围访问外部库
      if (ctx?.user?.role !== "branch_admin") {
        return { textForModel: `外部数据源（${dsId}）仅分行管理员可查询，当前角色无权访问。`, ui: null }
      }
      const db = getDb()
      const dsRow = db.prepare("SELECT * FROM data_sources WHERE id = ? AND enabled = 1").get(dsId) as Record<string, unknown> | undefined
      if (dsRow) {
        const password = decryptSecret(dsRow.password_enc as string | null)
        datasource = {
          type: dsRow.type,
          host: dsRow.host,
          port: dsRow.port,
          database_name: dsRow.database_name,
          username: dsRow.username,
          password,
          extra_config: JSON.parse(String(dsRow.extra_config || "{}")),
        }
      }
    }

    if (ctx?.user) {
      writeAuditLog({
        actorId: ctx.user.sub,
        actorName: ctx.user.name,
        actorRole: ctx.user.role,
        actorBranch: ctx.user.branch,
        action: "ai.codeact.exec",
        resourceType: "codeact",
        resourceId: dsId || null,
        summary: `${ctx.user.name} 执行 codeAct 分析${dsId ? `（外部数据源 ${dsId}）` : "（默认库）"}`,
        detail: { datasourceId: dsId || null, codeLength: code.length, codePreview: code.slice(0, 300) },
        ipAddress: null,
        requestId: null,
        dataScope: scope?.type ?? null,
      })
    }

    try {
      const res = await fetch("http://127.0.0.1:8765/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, scope, ...(datasource ? { datasource } : {}) }),
        signal: AbortSignal.timeout(35000),
      })
      if (!res.ok) throw new Error(`CodeAct sidecar HTTP ${res.status}`)

      const json = await res.json() as { stdout: string; stderr: string; charts: ChartSpec[] }
      const { stdout, stderr, charts } = json

      if (charts.length > 0) {
        return {
          textForModel: `分析完成，生成了 ${charts.length} 个图表。${stdout ? "数据摘要：" + stdout.slice(0, 300) : ""}`,
          ui: { resultType: "chart" as const, data: { charts, stdout, task: String(args.task ?? args.code ?? "").slice(0, 100) } },
        }
      }
      if (stdout) {
        return {
          textForModel: `分析完成。${stdout.slice(0, 400)}`,
          ui: { resultType: "report" as const, data: { generatedReport: stdout, customer: null, riskSignals: [] } },
        }
      }
      return { textForModel: stderr ? `执行出错：${stderr.slice(0, 300)}` : "无输出结果。", ui: null }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { textForModel: `CodeAct 分析引擎暂时不可用（${msg}）。`, ui: null }
    }
  },
}

const BASE_INSTRUCTIONS = `你是「丰年银行 AI 客户经营助手」的内核 Agent，服务对象是支行管理者与客户经理。

工作守则：
1. 收到用户请求后，先判断需要哪个工具，再调用对应 function。
2. **只传递用户明确提到的参数**。所有 schema 字段都是可选的，不要为了"补全"而填入默认值、0、false 或空字符串——多余的参数会引入隐式过滤条件、导致结果为空。
3. 调用工具时，参数必须来自用户原话；不要凭空创造客户姓名、金额、风险等级、客户经理姓名。
4. 工具返回 JSON 后，请用中文给出 2~3 句**简洁的业务结论**（不要复述参数，不要罗列字段）。
5. 始终保持银行合规口吻：不输出未脱敏的真实身份证号/手机号；不臆造监管政策。
6. 如果用户请求不属于已声明的工具（比如闲聊 / 通用知识），直接用中文简要回答即可，不调用工具。

可用工具：
- filterCustomers：客户清单筛选（仅传用户提及的条件，如 community / minAvgDeposit / hasOtherBankLoan / unusedCredit）
- getManagerPerformance：客户经理绩效（无参数）
- scanAlerts：业务预警扫描（仅传 severity / types / status 中用户提及的项）
- analyzeCustomer：客户 360° 画像（必传 query=客户姓名/编号）
- generateInvestigationReport：贷前调查报告（必传 query=客户姓名/编号）
- generateScript：个性化话术生成（必传 query=客户姓名/编号，可选 scene=营销/催收/续存/转介绍）
- queryDatabase：自动选表查询（可选 table=customers/managers/alerts/products/visits）
- exportData：CSV 导出（必传 type ∈ {customers, managers, alerts}）
- codeActAnalysis：**图表生成 / 衍生指标计算 / 跨表聚合**（必传 code=完整 Python，用 query()/emit_chart()，**沙箱只有标准库、禁止 import pandas/numpy**）。**有图表或复合指标需求时优先用此工具；普通筛选/预警/画像用上面专用工具。**

正例：用户说"梳理高新区·锦园中日均存款大于 10 万的客户"
→ filterCustomers({ community: "高新区·锦园", minAvgDeposit: 100000 })

反例（不要这样）：filterCustomers({ community: "...", minAvgDeposit: 100000, maxAvgDeposit: 0, riskLevel: "low", hasOtherBankLoan: false, ... })

输出风格示例：「已为你筛选出 12 位高日均存款客户，主要集中在高新一网格，建议优先安排李雪经理跟进。」`

export function buildSystemPrompt(skillPrompts: string[] = [], ctx?: AgentCtx): string {
  const parts: string[] = [BASE_INSTRUCTIONS]
  if (skillPrompts.length) parts.push(skillPrompts.join("\n\n"))
  if (ctx?.user && ctx?.scope) {
    parts.push(`当前登录用户：${ctx.user.name}（角色：${ctx.user.role}${ctx.user.branch ? "，所在机构：" + ctx.user.branch : ""}）。数据访问范围：${ctx.scope.label}。所有查询和分析只能基于用户权限范围内的数据进行，禁止越权访问其他机构或人员的数据。`)
  }
  // 注入真实数据字典：让模型「自主选表」并「正确匹配字段」，取代硬编码表结构
  const schemaBlock = buildSchemaPrompt(ctx?.schema, ctx?.focusTable)
  if (schemaBlock) parts.push(schemaBlock)
  if (ctx?.schema && ctx.schema.source !== "default") {
    parts.push(`当前数据源是外部库（id=${ctx.schema.source}）。请只用 codeActAnalysis 工具查询它；filterCustomers/scanAlerts/analyzeCustomer 等专用工具仅作用于默认客户库 bank.db。`)
  }
  return parts.join("\n\n")
}

/** 向后兼容 */
export const TOOL_INSTRUCTIONS = BASE_INSTRUCTIONS
