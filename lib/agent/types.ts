export type Intent =
  | "customer_segment"
  | "vertical_management"
  | "business_alert"
  | "customer_analysis"
  | "generate_report"
  | "generate_script"
  | "query_database"
  | "export_data"
  | "code_analysis"
  | "knowledge"
  | "unknown"

export type AgentStepStatus = "pending" | "running" | "done" | "error"

export type AgentStep = {
  id: string
  title: string
  description: string
  status: AgentStepStatus
}

export type AgentResultType = "table" | "chart" | "report" | "alert" | "file" | "empty" | "profile"

export type AgentResponse = {
  intent: Intent
  summary: string
  steps: AgentStep[]
  resultType: AgentResultType
  data: unknown
  suggestedNextActions: string[]
  /** 实际驱动本轮回答的 agent 标识：模型 id（如 "qwen-plus"）/ "mock" / "mock-fallback" */
  _agent?: string
  _llmError?: string
}

/** SSE 流式事件 */
export type StreamEvent =
  | { type: "step"; step: AgentStep }
  | { type: "text_delta"; delta: string }
  | { type: "done"; response: AgentResponse }
  | { type: "error"; message: string }
