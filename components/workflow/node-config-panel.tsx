"use client"

import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Node } from "@xyflow/react"
import { BUILTIN_SKILLS } from "@/lib/agent/skill-store"

const TOOL_OPTIONS = [
  { value: "filterCustomers",       label: "筛选客户" },
  { value: "scanAlerts",            label: "扫描预警" },
  { value: "getManagerPerformance", label: "经理绩效" },
  { value: "queryDatabase",         label: "查询数据库" },
  { value: "analyzeCustomer",       label: "客户画像分析" },
  { value: "generateInvestigationReport", label: "生成调查报告" },
  { value: "generateScript",        label: "生成营销话术" },
]

export function NodeConfigPanel({
  node, onUpdate, onClose,
}: {
  node: Node
  onUpdate: (patch: Record<string, unknown>) => void
  onClose: () => void
}) {
  const d = node.data as Record<string, unknown>
  const type = node.type ?? ""

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col overflow-hidden shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">节点配置</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <Field label="节点名称">
          <Input value={String(d.label ?? "")} onChange={(e) => onUpdate({ label: e.target.value })} />
        </Field>

        {/* Output var */}
        <Field label="输出变量名" hint="其他节点用 {{变量名}} 引用">
          <Input
            value={String(d.outputVar ?? "")}
            onChange={(e) => onUpdate({ outputVar: e.target.value })}
            placeholder="如: result"
          />
        </Field>

        {/* LLM node fields */}
        {type === "llm" && (
          <>
            <Field label="System Prompt（提示词）" hint="可用 {{变量名}} 引用上游输出">
              <textarea
                value={String(d.systemPrompt ?? "")}
                onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
                rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="你是银行AI助手，负责…"
              />
            </Field>
            <Field label="User 模板" hint="{{input}} 引用用户输入，{{变量名}} 引用上游">
              <textarea
                value={String(d.userTemplate ?? "")}
                onChange={(e) => onUpdate({ userTemplate: e.target.value })}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="请分析：{{input}}"
              />
            </Field>
          </>
        )}

        {/* Tool node */}
        {type === "tool" && (
          <>
            <Field label="选择工具">
              <Select value={String(d.toolName ?? "")} onValueChange={(v) => onUpdate({ toolName: v })}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="选择工具" /></SelectTrigger>
                <SelectContent>
                  {TOOL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="参数 JSON（可选）" hint="支持 {{变量名}} 插值">
              <textarea
                value={d.toolArgs ? JSON.stringify(d.toolArgs, null, 2) : ""}
                onChange={(e) => {
                  try { onUpdate({ toolArgs: JSON.parse(e.target.value) }) } catch { /* ignore */ }
                }}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder='{"query": "{{input}}"}'
              />
            </Field>
          </>
        )}

        {/* CodeAct node */}
        {type === "codeact" && (
          <>
            <Field label="Python 代码" hint="可用 query() query_one() emit_chart()">
              <textarea
                value={String(d.code ?? "")}
                onChange={(e) => onUpdate({ code: e.target.value })}
                rows={10}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={`rows = query("SELECT * FROM customers LIMIT 5")
for r in rows:
    print(r['name'], r['avg_deposit'])`}
              />
            </Field>
          </>
        )}

        {/* Condition node */}
        {type === "condition" && (
          <Field label="条件表达式" hint="返回 true/false，右侧上端=true 下端=false">
            <textarea
              value={String(d.expression ?? "")}
              onChange={(e) => onUpdate({ expression: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={`"{{riskReport}}".includes("高风险")`}
            />
          </Field>
        )}

        {/* Skill node */}
        {type === "skill" && (
          <Field label="选择 Skill">
            <Select value={String(d.skillId ?? "")} onValueChange={(v) => onUpdate({ skillId: v })}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="选择 Skill" /></SelectTrigger>
              <SelectContent>
                {BUILTIN_SKILLS.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {(type === "start" || type === "end") && (
          <p className="text-xs text-muted-foreground">此节点无需额外配置。</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}
