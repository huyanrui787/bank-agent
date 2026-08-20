"use client"

import { Database, Table2, Columns3 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import type { TableSchema } from "@/lib/db/schema-info"

export type DatasourceOption = {
  /** null 表示默认库 bank.db */
  id: string | null
  name: string
  type: string
}

type Props = {
  datasources: DatasourceOption[]
  selectedDsId: string | null
  onSelectDs: (id: string | null) => void
  tables: TableSchema[]
  selectedTable: string | null
  onSelectTable: (name: string | null) => void
  loading?: boolean
}

const MAX_COLS = 10

export function DatasourceTableSelector({
  datasources, selectedDsId, onSelectDs, tables, selectedTable, onSelectTable, loading,
}: Props) {
  const activeTable = tables.find((t) => t.name === selectedTable) ?? null
  const visibleCols = activeTable ? activeTable.columns.slice(0, MAX_COLS) : []
  const hiddenCount = activeTable ? activeTable.columns.length - visibleCols.length : 0

  return (
    <div className="shrink-0 border-t border-border px-4 py-2.5 space-y-2 bg-muted/20">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
          <Database className="h-3.5 w-3.5" />数据源
        </span>
        <Select
          value={selectedDsId ?? "__default__"}
          onValueChange={(v) => onSelectDs(v === "__default__" ? null : v)}
          disabled={loading}
        >
          <SelectTrigger className="h-8 w-56 text-xs">
            <SelectValue placeholder="选择数据源" />
          </SelectTrigger>
          <SelectContent>
            {datasources.map((ds) => (
              <SelectItem key={ds.id ?? "__default__"} value={ds.id ?? "__default__"}>
                {ds.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
          <Table2 className="h-3.5 w-3.5" />选表（可选）
        </span>
        <Select
          value={selectedTable ?? "__auto__"}
          onValueChange={(v) => onSelectTable(v === "__auto__" ? null : v)}
          disabled={loading || tables.length === 0}
        >
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder={tables.length ? "由 AI 自主选表" : "无可用表"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto__">由 AI 自主选表</SelectItem>
            {tables.map((t) => (
              <SelectItem key={t.name} value={t.name}>
                {t.name}{t.comment ? `（${t.comment}）` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loading && <span className="text-xs text-muted-foreground animate-pulse">加载表结构…</span>}
      </div>

      {activeTable && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0">
            <Columns3 className="h-3 w-3" />字段
          </span>
          {visibleCols.map((c) => (
            <span
              key={c.name}
              title={c.comment ?? c.type}
              className={cn(
                "px-1.5 py-0.5 rounded border text-[10px] font-mono",
                c.pk ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground"
              )}
            >
              {c.name}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="text-[10px] text-muted-foreground">+{hiddenCount} 字段</span>
          )}
        </div>
      )}
    </div>
  )
}
