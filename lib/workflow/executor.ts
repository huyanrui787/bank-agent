import { callLlm } from "@/lib/agent/llm"
import { toolHandlers } from "@/lib/agent/tools"
import { BUILTIN_SKILLS, getSkillPrompts } from "@/lib/agent/skill-store"
import { getDb } from "@/lib/db"
import { decryptSecret } from "@/lib/security/encrypt"
import vm from "node:vm"
import {
  WorkflowDefinition, WFNode, WFEdge,
  NodeRunResult, WorkflowRunEvent, interpolate, topoSort,
} from "./types"

/** 受限表达式求值：仅暴露插值后的字面量，禁用 process/require 等宿主对象，替代裸 eval。 */
function evalCondition(expression: string, vars: Record<string, unknown>): boolean {
  const expr = expression.replace(/\{\{(\w+)\}\}/g, (_, k) => JSON.stringify(vars[k] ?? ""))
  try {
    const result = vm.runInNewContext(expr, Object.create(null), { timeout: 100 })
    return Boolean(result)
  } catch {
    const s = expr.trim()
    return s !== "" && s !== "false" && s !== "0"
  }
}

export type ExecuteCtx = {
  userId?: string
  userName?: string
  role?: string
}

export async function* executeWorkflow(
  def: WorkflowDefinition,
  inputVars: Record<string, unknown> = {},
  ctx?: ExecuteCtx,
): AsyncGenerator<WorkflowRunEvent> {
  const vars: Record<string, unknown> = { ...inputVars }
  const results: NodeRunResult[] = []
  const skipped = new Set<string>()

  let sorted: WFNode[]
  try {
    sorted = topoSort(def.nodes, def.edges)
  } catch {
    yield { type: "flow_error", error: "工作流存在循环依赖" }
    return
  }

  for (const node of sorted) {
    if (skipped.has(node.id)) {
      results.push({ nodeId: node.id, status: "skipped" })
      continue
    }

    yield { type: "node_start", nodeId: node.id, label: node.data.label }
    const t0 = Date.now()

    try {
      const output = await runNode(node, vars, def.edges, skipped, ctx)
      const durationMs = Date.now() - t0

      // Store output under nodeId and optional outputVar
      vars[node.id] = output
      if (node.data.outputVar) vars[node.data.outputVar] = output

      results.push({ nodeId: node.id, status: "done", output, durationMs })
      yield { type: "node_done", nodeId: node.id, output, durationMs }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      results.push({ nodeId: node.id, status: "error", error })
      yield { type: "node_error", nodeId: node.id, error }
      // Abort on error
      yield { type: "flow_done", results }
      return
    }
  }

  yield { type: "flow_done", results }
}

async function runNode(
  node: WFNode,
  vars: Record<string, unknown>,
  edges: WFEdge[],
  skipped: Set<string>,
  ctx?: ExecuteCtx,
): Promise<unknown> {
  const d = node.data

  switch (node.type) {
    case "start":
      return vars.input ?? ""

    case "end":
      return vars.output ?? Object.values(vars).slice(-2)[0] ?? ""

    case "llm": {
      const systemPrompt = d.systemPrompt ? interpolate(d.systemPrompt, vars) : "你是银行 AI 助手。"
      const userMsg = d.userTemplate ? interpolate(d.userTemplate, vars) : String(vars.input ?? "")

      // Add skill prompts if any
      const loadedSkills = d.skillId ? [d.skillId] : []
      const skillPrompts = getSkillPrompts(loadedSkills, BUILTIN_SKILLS)
      const fullSystem = [systemPrompt, ...skillPrompts].join("\n\n")

      const result = await callLlm({
        instructions: fullSystem,
        input: [{ role: "user", content: [{ type: "input_text", text: userMsg }] }],
      })
      return result.text.trim()
    }

    case "tool": {
      const toolName = d.toolName ?? "filterCustomers"
      const handler = toolHandlers[toolName]
      if (!handler) throw new Error(`未知工具：${toolName}`)

      const rawArgs = d.toolArgs ? interpolateObject(d.toolArgs, vars) : {}
      const agentCtx = ctx ? {
        user: { sub: ctx.userId ?? "", name: ctx.userName ?? "", role: ctx.role as "manager", branch: null, grid: null, managerId: null },
        scope: { type: "bank" as const, customer: null, manager: null, alert: null, label: "全行" },
      } : undefined

      const res = await Promise.resolve(handler(rawArgs, agentCtx))
      return res.textForModel
    }

    case "codeact": {
      const code = d.code ? interpolate(d.code, vars) : "print('no code')"
      const body: Record<string, unknown> = { code }

      if (d.datasourceId) {
        const db = getDb()
        const dsRow = db.prepare("SELECT * FROM data_sources WHERE id = ? AND enabled = 1").get(d.datasourceId) as Record<string, unknown> | undefined
        if (dsRow) {
          const password = decryptSecret(dsRow.password_enc as string | null)
          body.datasource = { type: dsRow.type, host: dsRow.host, port: dsRow.port, database_name: dsRow.database_name, username: dsRow.username, password, extra_config: JSON.parse(String(dsRow.extra_config || "{}")) }
        }
      }

      const res = await fetch("http://127.0.0.1:8765/exec", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(35000),
      })
      if (!res.ok) throw new Error(`CodeAct sidecar HTTP ${res.status}`)
      const json = await res.json() as { stdout: string; stderr: string; charts: unknown[] }
      if (json.stderr && !json.stdout) throw new Error(json.stderr)
      return json.stdout || (json.charts.length > 0 ? `[${json.charts.length} 个图表]` : "")
    }

    case "condition": {
      const result = evalCondition(d.expression ?? "true", vars)

      // Skip edges that don't match
      const outEdges = edges.filter((e) => e.source === node.id)
      for (const edge of outEdges) {
        const handle = edge.sourceHandle ?? "true"
        if ((result && handle === "false") || (!result && handle === "true")) {
          // Mark all downstream nodes of this edge as skipped
          markDownstreamSkipped(edge.target, edges, skipped)
        }
      }
      return result
    }

    case "skill": {
      const skillId = d.skillId ?? ""
      const skill = BUILTIN_SKILLS.find((s) => s.id === skillId)
      if (!skill) {
        // Try custom skill from DB
        const db = getDb()
        const row = db.prepare("SELECT input_schema_description FROM custom_skills WHERE id = ?").get(skillId) as { input_schema_description: string } | undefined
        return row?.input_schema_description ?? `Skill ${skillId} not found`
      }
      return skill.prompt
    }

    default:
      return null
  }
}

function interpolateObject(obj: Record<string, unknown>, vars: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    result[k] = typeof v === "string" ? interpolate(v, vars) : v
  }
  return result
}

function markDownstreamSkipped(nodeId: string, edges: WFEdge[], skipped: Set<string>) {
  if (skipped.has(nodeId)) return
  skipped.add(nodeId)
  for (const e of edges.filter((e) => e.source === nodeId)) {
    markDownstreamSkipped(e.target, edges, skipped)
  }
}
