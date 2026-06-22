// ── Node types ────────────────────────────────────────────────────────────────

export type WFNodeType = "start" | "end" | "llm" | "tool" | "codeact" | "condition" | "skill"

export type WFNodeData = {
  label: string
  // llm
  systemPrompt?: string
  userTemplate?: string   // supports {{variable}} interpolation
  model?: string
  // tool
  toolName?: string       // filterCustomers | scanAlerts | getManagerPerformance | queryDatabase
  toolArgs?: Record<string, unknown>
  // codeact
  code?: string
  datasourceId?: string
  // condition
  expression?: string     // e.g. "{{llm_output}} includes '高风险'"
  // skill
  skillId?: string
  // output variable name (other nodes reference via {{nodeId}})
  outputVar?: string
}

export type WFNode = {
  id: string
  type: WFNodeType
  position: { x: number; y: number }
  data: WFNodeData
}

export type WFEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string   // "true" | "false" for condition nodes
  label?: string
}

export type WorkflowDefinition = {
  nodes: WFNode[]
  edges: WFEdge[]
}

export type Workflow = {
  id: string
  name: string
  description: string
  definition: WorkflowDefinition
  enabled: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

// ── Execution types ───────────────────────────────────────────────────────────

export type NodeStatus = "pending" | "running" | "done" | "error" | "skipped"

export type NodeRunResult = {
  nodeId: string
  status: NodeStatus
  output?: unknown
  error?: string
  durationMs?: number
}

export type WorkflowRunEvent =
  | { type: "node_start";  nodeId: string; label: string }
  | { type: "node_done";   nodeId: string; output: unknown; durationMs: number }
  | { type: "node_error";  nodeId: string; error: string }
  | { type: "flow_done";   results: NodeRunResult[] }
  | { type: "flow_error";  error: string }

// ── Variable interpolation ────────────────────────────────────────────────────

export function interpolate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key]
    if (v === undefined || v === null) return ""
    if (typeof v === "object") return JSON.stringify(v)
    return String(v)
  })
}

// ── Topological sort ──────────────────────────────────────────────────────────

export function topoSort(nodes: WFNode[], edges: WFEdge[]): WFNode[] {
  const inDeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of nodes) { inDeg.set(n.id, 0); adj.set(n.id, []) }
  for (const e of edges) {
    adj.get(e.source)!.push(e.target)
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
  }
  const queue = nodes.filter((n) => inDeg.get(n.id) === 0)
  const sorted: WFNode[] = []
  while (queue.length) {
    const n = queue.shift()!
    sorted.push(n)
    for (const nb of adj.get(n.id) ?? []) {
      const d = (inDeg.get(nb) ?? 1) - 1
      inDeg.set(nb, d)
      if (d === 0) queue.push(nodes.find((x) => x.id === nb)!)
    }
  }
  return sorted.filter(Boolean)
}
