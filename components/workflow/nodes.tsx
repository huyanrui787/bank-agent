"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Brain, Wrench, Code2, GitBranch, Sparkles, Play, Square } from "lucide-react"

type NodeData = { label?: string; [key: string]: unknown }

function BaseNode({
  children, icon, color, data, selected,
  hasInput = true, hasOutput = true,
}: {
  children?: React.ReactNode
  icon: React.ReactNode
  color: string
  data: NodeData
  selected?: boolean
  hasInput?: boolean
  hasOutput?: boolean
}) {
  return (
    <div className={`min-w-[140px] max-w-[200px] rounded-lg border-2 bg-card shadow-sm transition-all ${selected ? "border-primary" : "border-border"}`}>
      {hasInput && <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-background" style={{ background: color }} />}
      <div className="px-3 py-2 flex items-center gap-2">
        <div className={`h-6 w-6 rounded flex items-center justify-center shrink-0 text-white`} style={{ background: color }}>
          {icon}
        </div>
        <span className="text-xs font-medium truncate">{String(data.label ?? "节点")}</span>
      </div>
      {children && <div className="px-3 pb-2 text-[10px] text-muted-foreground">{children}</div>}
      {hasOutput && <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-background" style={{ background: color }} />}
    </div>
  )
}

export function StartNode({ data, selected }: NodeProps) {
  return (
    <BaseNode icon={<Play className="h-3 w-3" />} color="#16a34a" data={data as NodeData} selected={selected} hasInput={false}>
      <span>输入变量</span>
    </BaseNode>
  )
}

export function EndNode({ data, selected }: NodeProps) {
  return (
    <BaseNode icon={<Square className="h-3 w-3" />} color="#dc2626" data={data as NodeData} selected={selected} hasOutput={false}>
      <span>输出结果</span>
    </BaseNode>
  )
}

export function LlmNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <BaseNode icon={<Brain className="h-3 w-3" />} color="#1e40af" data={d} selected={selected}>
      <span className="line-clamp-1">{String(d.userTemplate ?? "").slice(0, 40) || "点击配置提示词"}</span>
    </BaseNode>
  )
}

export function ToolNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <BaseNode icon={<Wrench className="h-3 w-3" />} color="#7c3aed" data={d} selected={selected}>
      <span>{String(d.toolName ?? "选择工具")}</span>
    </BaseNode>
  )
}

export function CodeActNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <BaseNode icon={<Code2 className="h-3 w-3" />} color="#0891b2" data={d} selected={selected}>
      <span>{String(d.code ?? "").slice(0, 40) || "点击编写代码"}</span>
    </BaseNode>
  )
}

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <div className={`min-w-[140px] rounded-lg border-2 bg-card shadow-sm ${selected ? "border-primary" : "border-border"}`}>
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-background" style={{ background: "#d97706" }} />
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="h-6 w-6 rounded flex items-center justify-center shrink-0 text-white" style={{ background: "#d97706" }}>
          <GitBranch className="h-3 w-3" />
        </div>
        <span className="text-xs font-medium truncate">{String(d.label ?? "条件")}</span>
      </div>
      <div className="px-3 pb-2 text-[10px] text-muted-foreground">
        <span>{String(d.expression ?? "").slice(0, 40) || "设置条件表达式"}</span>
      </div>
      {/* Two handles: true (top-right) and false (bottom-right) */}
      <Handle id="true"  type="source" position={Position.Right} style={{ top: "30%", background: "#16a34a" }} className="!w-3 !h-3 !border-2 !border-background" />
      <Handle id="false" type="source" position={Position.Right} style={{ top: "70%", background: "#dc2626" }} className="!w-3 !h-3 !border-2 !border-background" />
    </div>
  )
}

export function SkillNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <BaseNode icon={<Sparkles className="h-3 w-3" />} color="#9333ea" data={d} selected={selected}>
      <span>{String(d.skillId ?? "选择 Skill")}</span>
    </BaseNode>
  )
}
