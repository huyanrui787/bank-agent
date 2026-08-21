/**
 * 用真实 LLM 驱动的 Agent 主循环。
 * - 调用 qwen-plus (OpenAI 兼容 Chat Completions API, SSE)
 * - 在多轮 tool-call 循环中执行本地工具
 * - 以 async generator 形式 yield StreamEvent，支持前端流式渲染
 */

import { callLlm, streamLlmText, isLlmConfigured, type ResponsesInputItem } from "./llm"
import { buildSystemPrompt, toolDefs, toolHandlers } from "./tools"
import { detectIntent } from "./intent-router"
import type { AgentResponse, AgentStep, AgentResultType, Intent, StreamEvent } from "./types"
import type { AccessTokenPayload } from "@/lib/auth/jwt"
import type { DataScope } from "@/lib/auth/scope"
import type { DbSchema } from "@/lib/db/schema-info"

export type AgentCtx = {
  user: Pick<AccessTokenPayload, "sub" | "name" | "role" | "branch" | "managerId">
  scope: DataScope
  /** 当前数据源的数据字典（表 + 字段），注入 System Prompt 用于 NL2SQL 选表 */
  schema?: DbSchema
  /** 用户当前选中的表（用于把该表排前并标注，未选则 LLM 自主选表） */
  focusTable?: string | null
  /** 外部数据源 ID；专用工具据此选择连接器（不传则用默认 bank.db） */
  datasourceId?: string
}

const MAX_TOOL_TURNS = 4

const intentByTool: Record<string, Intent> = {
  filterCustomers: "customer_segment",
  getManagerPerformance: "vertical_management",
  scanAlerts: "business_alert",
  analyzeCustomer: "customer_analysis",
  generateInvestigationReport: "generate_report",
  generateScript: "generate_script",
  queryDatabase: "query_database",
  exportData: "export_data",
  codeActAnalysis: "code_analysis",
  searchKnowledge: "knowledge",
}

export { isLlmConfigured }

export async function* streamLlmAgent(
  message: string,
  skillPrompts: string[] = [],
  ctx?: AgentCtx,
): AsyncGenerator<StreamEvent> {
  const steps: AgentStep[] = []
  let stepId = 1

  const pushStep = function* (title: string, description: string, status: AgentStep["status"] = "done"): Generator<StreamEvent> {
    const step: AgentStep = { id: String(stepId++), title, description, status }
    steps.push(step)
    yield { type: "step", step }
  }

  yield* pushStep("接收指令", `已收到用户请求：${truncate(message, 60)}`)

  const input: ResponsesInputItem[] = [
    {
      role: "user",
      content: [{ type: "input_text", text: message }],
    },
  ]

  let finalText = ""
  let resultType: AgentResultType = "empty"
  let resultData: unknown = null
  let intent: Intent = "unknown"
  const suggestedNextActions: string[] = []

  // 前置知识检索：qwen 系列对「知识问答/未知」类问题 tool_call 触发不稳，这里对非数据操作意图先检索 RAGFlow，
  // 命中则把结果注入 input，让 LLM 直接基于结果作答（无需再触发 tool_call）。
  const preIntent = detectIntent(message)
  const dataIntents: Intent[] = [
    "customer_segment", "vertical_management", "business_alert", "generate_report",
    "generate_script", "query_database", "customer_analysis", "code_analysis", "export_data",
  ]
  if (!dataIntents.includes(preIntent)) {
    try {
      const preResult = await Promise.resolve(toolHandlers.searchKnowledge({ query: message }, ctx))
      if (preResult.textForModel?.includes("知识库检索到")) {
        yield* pushStep("调用工具", "searchKnowledge（知识检索）", "done")
        input.push({ type: "function_call", call_id: "pre_knowledge", name: "searchKnowledge", arguments: JSON.stringify({ query: message }) })
        input.push({ type: "function_call_output", call_id: "pre_knowledge", output: JSON.stringify({ ok: true, summary: preResult.textForModel }) })
        if (preResult.ui) {
          resultType = preResult.ui.resultType
          resultData = preResult.ui.data
        }
        intent = "knowledge"
        yield* pushStep("工具结果", truncate(preResult.textForModel, 160))
      }
    } catch {
      // 前置检索失败（如 RAGFlow 未接入），走正常 tool_call 流程
    }
  }

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const llm = await callLlm({
      input,
      tools: toolDefs,
      instructions: buildSystemPrompt(skillPrompts, ctx),
    })

    if (llm.reasoningSummary.length) {
      const summary = llm.reasoningSummary
        .map((s) => s.trim())
        .filter(Boolean)
        .join("；")
      if (summary) yield* pushStep("AI 思考", truncate(summary, 160))
    }

    if (llm.toolCalls.length === 0) {
      // 最后一轮：用真流式输出 token
      finalText = ""
      yield* pushStep("生成回复", "正在输出…")
      for await (const token of streamLlmText({
        input,
        instructions: buildSystemPrompt(skillPrompts, ctx),
      })) {
        finalText += token
        yield { type: "text_delta", delta: token }
      }
      // 更新最后一个 step 的 description
      const lastStep = steps[steps.length - 1]
      if (lastStep?.title === "生成回复") {
        lastStep.description = truncate(finalText, 140)
      }
      break
    }

    // 把本轮 tool_calls 追加到 input（Chat Completions 多轮格式）
    for (const tc of llm.toolCalls) {
      input.push({
        type: "function_call",
        call_id: tc.call_id,
        name: tc.name,
        arguments: tc.arguments,
      })
    }

    for (const call of llm.toolCalls) {
      let parsedArgs: Record<string, unknown> = {}
      try {
        parsedArgs = JSON.parse(call.arguments || "{}")
      } catch {
        parsedArgs = {}
      }
      const handler = toolHandlers[call.name]
      const argsLabel = describeArgs(parsedArgs)
      yield* pushStep(
        "调用工具",
        `${call.name}${argsLabel ? "(" + argsLabel + ")" : ""}`,
        "done"
      )

      let outputText = ""
      if (!handler) {
        outputText = JSON.stringify({ error: `unknown tool ${call.name}` })
        yield* pushStep("工具异常", `未注册的工具：${call.name}`, "error")
      } else {
        try {
          const result = await Promise.resolve(handler(parsedArgs, ctx))
          outputText = JSON.stringify({ ok: true, summary: result.textForModel })
          if (result.ui) {
            resultType = result.ui.resultType
            resultData = result.ui.data
          }
          intent = intentByTool[call.name] ?? intent
          yield* pushStep("工具结果", truncate(result.textForModel, 160))
        } catch (err) {
          outputText = JSON.stringify({ ok: false, error: String(err) })
          yield* pushStep("工具异常", String(err), "error")
        }
      }

      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: outputText,
      })
    }
  }

  if (!finalText) {
    finalText = "AI 任务已完成，请查看下方结构化结果。"
    yield* pushStep("生成回复", finalText)
    for (const char of finalText) {
      yield { type: "text_delta", delta: char }
    }
  }

  if (intent === "customer_segment") {
    suggestedNextActions.push("导出 Excel", "按客户经理拆分", "生成营销话术")
  } else if (intent === "business_alert") {
    suggestedNextActions.push("查看紧急预警详情", "派发处理任务", "导出预警清单")
  } else if (intent === "customer_analysis" || intent === "generate_report") {
    suggestedNextActions.push("复制报告", "导出风险摘要", "生成营销话术")
  } else if (intent === "vertical_management") {
    suggestedNextActions.push("导出经理绩效", "下发督导任务")
  } else if (intent === "export_data") {
    suggestedNextActions.push("下载文件")
  } else if (intent === "code_analysis") {
    suggestedNextActions.push("继续深入分析", "导出图表数据", "生成调查报告")
  } else if (intent === "knowledge") {
    suggestedNextActions.push("继续提问", "查询贷款政策", "了解合规要求")
  } else {
    suggestedNextActions.push(
      "梳理高日均存款客户",
      "扫描本月业务预警",
      "分析张明的风险情况"
    )
  }

  const response: AgentResponse = {
    intent,
    summary: finalText,
    steps,
    resultType,
    data: resultData,
    suggestedNextActions,
    _agent: process.env.LLM_MODEL ?? "llm",
  }

  yield { type: "done", response }
}

/** 非流式版本，保留兼容性 */
export async function runLlmAgent(message: string, skillPrompts: string[] = []): Promise<AgentResponse> {
  let response: AgentResponse | null = null
  for await (const event of streamLlmAgent(message, skillPrompts)) {
    if (event.type === "done") response = event.response
  }
  return response!
}

function describeArgs(args: Record<string, unknown>) {
  const parts: string[] = []
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null || v === "" || v === false) continue
    if (typeof v === "number" && v === 0) continue
    const sv = typeof v === "object" ? JSON.stringify(v) : String(v)
    parts.push(`${k}=${sv.length > 24 ? sv.slice(0, 24) + "…" : sv}`)
  }
  return parts.join(", ")
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + "…"
}
