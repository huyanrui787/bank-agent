"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { ReactFlow, Background, Controls, MiniMap, addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react"
import type { Node, Edge, Connection, NodeChange, EdgeChange } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { toast } from "sonner"
import { Play, Save, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StartNode, EndNode, LlmNode, ToolNode, CodeActNode, ConditionNode, SkillNode } from "@/components/workflow/nodes"
import { NodeConfigPanel } from "@/components/workflow/node-config-panel"
import { RunPanel } from "@/components/workflow/run-panel"
import type { WFNode, WFEdge, WorkflowRunEvent, NodeStatus } from "@/lib/workflow/types"
import { randomId } from "@/lib/utils"

const nodeTypes = {
  start: StartNode, end: EndNode, llm: LlmNode,
  tool: ToolNode, codeact: CodeActNode, condition: ConditionNode, skill: SkillNode,
}

const EDGE_STYLE = { style: { strokeWidth: 2, stroke: "#94a3b8" }, animated: false }

export default function WorkflowEditor() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const autoRun = searchParams.get("run") === "1"

  const [name, setName] = useState("工作流")
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [saving, setSaving] = useState(false)
  const [runInput, setRunInput] = useState("")
  const [running, setRunning] = useState(false)
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, NodeStatus>>({})
  const [runLog, setRunLog] = useState<WorkflowRunEvent[]>([])
  const [showRunPanel, setShowRunPanel] = useState(autoRun)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch(`/api/workflows/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setName(d.name)
        setNodes((d.definition.nodes ?? []).map((n: WFNode) => ({
          id: n.id, type: n.type, position: n.position, data: n.data,
        })))
        setEdges((d.definition.edges ?? []).map((e: WFEdge) => ({
          id: e.id, source: e.source, target: e.target,
          sourceHandle: e.sourceHandle, label: e.label, ...EDGE_STYLE,
        })))
      })
      .catch(() => toast.error("加载失败"))
  }, [id])

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)), [])
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)), [])
  const onConnect = useCallback((conn: Connection) => setEdges((es) => addEdge({ ...conn, ...EDGE_STYLE }, es)), [])

  function updateNodeData(nodeId: string, patch: Record<string, unknown>) {
    setNodes((ns) => ns.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...patch } } : prev)
  }

  function addNode(type: string) {
    const nid = randomId().slice(0, 8)
    const labels: Record<string, string> = {
      llm: "LLM 节点", tool: "工具节点", codeact: "代码执行", condition: "条件分支", skill: "技能注入",
    }
    setNodes((ns) => [...ns, {
      id: nid, type,
      position: { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: { label: labels[type] ?? type },
    }])
  }

  async function handleSave() {
    setSaving(true)
    try {
      const definition = {
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, label: e.label })),
      }
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, definition }),
      })
      if (!res.ok) throw new Error("保存失败")
      toast.success("已保存")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败")
    } finally { setSaving(false) }
  }

  async function handleRun() {
    if (running) { abortRef.current?.abort(); return }
    await handleSave()
    setRunning(true); setRunLog([]); setNodeStatuses({})
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await fetch(`/api/workflows/${id}/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: runInput }), signal: ac.signal,
      })
      if (!res.body) throw new Error("no body")
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split("\n\n"); buf = parts.pop() ?? ""
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue
          try {
            const event = JSON.parse(part.slice(6)) as WorkflowRunEvent
            setRunLog((prev) => [...prev, event])
            if (event.type === "node_start")       setNodeStatuses((p) => ({ ...p, [event.nodeId]: "running" }))
            else if (event.type === "node_done")   setNodeStatuses((p) => ({ ...p, [event.nodeId]: "done" }))
            else if (event.type === "node_error")  setNodeStatuses((p) => ({ ...p, [event.nodeId]: "error" }))
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("运行出错")
    } finally { setRunning(false) }
  }

  const nodesWithStatus = nodes.map((n) => {
    const s = nodeStatuses[n.id]
    return {
      ...n,
      style: s === "running" ? { border: "2px solid #f59e0b", boxShadow: "0 0 8px #f59e0b44" }
           : s === "done"    ? { border: "2px solid #16a34a" }
           : s === "error"   ? { border: "2px solid #dc2626" }
           : {},
    }
  })

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card z-10 shrink-0">
        <button onClick={() => router.push("/workflow")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          className="text-sm font-medium bg-transparent border-none outline-none w-48"
        />
        <div className="flex items-center gap-1 ml-2 flex-wrap">
          {[
            { type: "llm", label: "+ LLM" }, { type: "tool", label: "+ 工具" },
            { type: "codeact", label: "+ 代码" }, { type: "condition", label: "+ 条件" },
            { type: "skill", label: "+ 技能" },
          ].map((item) => (
            <button key={item.type} onClick={() => addNode(item.type)}
              className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent transition-colors">
              {item.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "保存中…" : "保存"}
          </Button>
          <Button size="sm" onClick={() => setShowRunPanel(true)}>
            <Play className="h-3.5 w-3.5 mr-1" /> 运行
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <ReactFlow
            nodes={nodesWithStatus} edges={edges} nodeTypes={nodeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            fitView fitViewOptions={{ padding: 0.2 }}
          >
            <Background />
            <Controls />
            <MiniMap nodeColor={(n) => {
              const t = n.type ?? ""
              return t === "start" ? "#16a34a" : t === "end" ? "#dc2626" : t === "llm" ? "#1e40af" : t === "condition" ? "#d97706" : "#64748b"
            }} />
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodeConfigPanel node={selectedNode} onUpdate={(p) => updateNodeData(selectedNode.id, p)} onClose={() => setSelectedNode(null)} />
        )}

        {showRunPanel && (
          <RunPanel running={running} runInput={runInput} onInputChange={setRunInput}
            onRun={handleRun} onClose={() => setShowRunPanel(false)} log={runLog} />
        )}
      </div>
    </div>
  )
}
