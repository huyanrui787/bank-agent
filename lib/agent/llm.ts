/**
 * OpenAI-compatible Chat Completions 客户端（支持 Qwen / OpenAI 等）。
 * callLlm: 非流式，返回完整 LlmTurn（用于 tool-call 轮次）
 * streamLlmText: 流式 async generator，逐 token yield（用于最终回复轮次）
 */

export type ResponsesInputItem =
  | {
      type?: "message"
      role: "user" | "assistant" | "system" | "developer"
      content:
        | string
        | { type: "input_text" | "output_text"; text: string }[]
    }
  | {
      type: "function_call"
      call_id: string
      name: string
      arguments: string
    }
  | {
      type: "function_call_output"
      call_id: string
      output: string
    }

export type ToolDef = {
  type: "function"
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type ToolCall = {
  call_id: string
  name: string
  arguments: string
}

export type LlmTurn = {
  text: string
  toolCalls: ToolCall[]
  reasoningSummary: string[]
  rawOutputItems: unknown[]
}

const PROVIDER_BASE = process.env.LLM_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
const PROVIDER_KEY = process.env.LLM_API_KEY ?? ""
const MODEL = process.env.LLM_MODEL ?? "qwen-plus"

export function isLlmConfigured() {
  return !!PROVIDER_KEY
}

/** 把 ResponsesInputItem[] 转成 Chat Completions messages 格式 */
function toMessages(input: ResponsesInputItem[], instructions?: string): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = []

  if (instructions) {
    messages.push({ role: "system", content: instructions })
  }

  for (const item of input) {
    if ("type" in item && item.type === "function_call") {
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: [{
          id: item.call_id,
          type: "function",
          function: { name: item.name, arguments: item.arguments },
        }],
      })
    } else if ("type" in item && item.type === "function_call_output") {
      messages.push({
        role: "tool",
        tool_call_id: item.call_id,
        content: item.output,
      })
    } else {
      const msg = item as { role: string; content: string | { type: string; text: string }[] }
      const role = msg.role === "developer" ? "system" : msg.role
      const content = Array.isArray(msg.content)
        ? msg.content.map((c) => c.text).join("")
        : msg.content
      messages.push({ role, content })
    }
  }

  return messages
}

async function fetchCompletion(opts: {
  input: ResponsesInputItem[]
  tools?: ToolDef[]
  instructions?: string
  signal?: AbortSignal
}) {
  if (!PROVIDER_KEY) throw new Error("LLM_API_KEY 未配置")

  const messages = toMessages(opts.input, opts.instructions)
  const tools = opts.tools?.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    stream: true,
    stream_options: { include_usage: false },
  }
  if (tools && tools.length > 0) {
    body.tools = tools
    body.parallel_tool_calls = false
  }

  const res = await fetch(`${PROVIDER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PROVIDER_KEY}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "")
    throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 400)}`)
  }

  return res.body
}

function* parseSseLine(line: string): Generator<{ content?: string; reasoning?: string; toolCallDelta?: { index: number; id?: string; name?: string; arguments?: string }; done?: boolean }> {
  if (!line.startsWith("data:")) return
  const dataStr = line.slice(5).trim()
  if (dataStr === "[DONE]") { yield { done: true }; return }
  let data: Record<string, unknown>
  try { data = JSON.parse(dataStr) } catch { return }

  const choices = data.choices as { delta?: Record<string, unknown> }[] | undefined
  if (!choices?.length) return

  for (const choice of choices) {
    const delta = choice.delta
    if (!delta) continue
    if (typeof delta.content === "string" && delta.content) {
      yield { content: delta.content }
    }
    const raw = delta as Record<string, unknown>
    const reasoning = raw.reasoning_content ?? raw.reasoning
    if (typeof reasoning === "string" && reasoning) {
      yield { reasoning }
    }
    const tcs = delta.tool_calls as { index: number; id?: string; function?: { name?: string; arguments?: string } }[] | undefined
    if (tcs) {
      for (const tc of tcs) {
        yield { toolCallDelta: { index: tc.index ?? 0, id: tc.id, name: tc.function?.name, arguments: tc.function?.arguments } }
      }
    }
  }
}

/** 非流式：等待完整响应，返回 LlmTurn（用于 tool-call 轮次） */
export async function callLlm(opts: {
  input: ResponsesInputItem[]
  tools?: ToolDef[]
  instructions?: string
  signal?: AbortSignal
}): Promise<LlmTurn> {
  const body = await fetchCompletion(opts)
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let text = ""
  const reasoningParts: string[] = []
  const toolCallMap: Record<number, { id: string; name: string; arguments: string }> = {}

  const consumeBlock = (block: string) => {
    for (const line of block.split("\n")) {
      for (const parsed of parseSseLine(line)) {
        if (parsed.content) text += parsed.content
        if (parsed.reasoning) reasoningParts.push(parsed.reasoning)
        if (parsed.toolCallDelta) {
          const { index, id, name, arguments: args } = parsed.toolCallDelta
          if (!toolCallMap[index]) toolCallMap[index] = { id: "", name: "", arguments: "" }
          if (id) toolCallMap[index].id = id
          if (name) toolCallMap[index].name += name
          if (args) toolCallMap[index].arguments += args
        }
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")
    let idx
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      consumeBlock(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 2)
    }
  }
  consumeBlock(buffer) // flush 末尾残留

  const toolCalls: ToolCall[] = Object.values(toolCallMap)
    .filter((tc) => tc.name)
    .map((tc) => ({ call_id: tc.id || crypto.randomUUID(), name: tc.name, arguments: tc.arguments || "{}" }))

  const reasoningText = reasoningParts.join("").trim()
  return { text, toolCalls, reasoningSummary: reasoningText ? [reasoningText] : [], rawOutputItems: [] }
}

/** 流式：逐 token yield string，用于最终回复轮次 */
export async function* streamLlmText(opts: {
  input: ResponsesInputItem[]
  instructions?: string
  signal?: AbortSignal
}): AsyncGenerator<string> {
  const body = await fetchCompletion({ ...opts, tools: undefined })
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const yieldBlock = function* (block: string): Generator<string> {
    for (const line of block.split("\n")) {
      for (const parsed of parseSseLine(line)) {
        if (parsed.content) yield parsed.content
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")
    let idx
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      yield* yieldBlock(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 2)
    }
  }
  yield* yieldBlock(buffer) // flush 末尾残留
}
