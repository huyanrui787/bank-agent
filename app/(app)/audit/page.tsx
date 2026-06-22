"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Shield, RefreshCw, CheckCircle, XCircle } from "lucide-react"
import { useUser } from "@/lib/hooks/use-user"
import { useRouter } from "next/navigation"

type AuditRow = {
  id: string
  created_at: string
  actor_name: string
  actor_role: string
  actor_branch: string | null
  action: string
  resource_type: string
  resource_id: string | null
  summary: string
  ip_address: string | null
  data_scope: string | null
}

type AuditResponse = {
  rows: AuditRow[]
  total: number
  page: number
  pageSize: number
  chainIntegrity?: { valid: boolean; brokenAt?: string; checked: number }
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "登录",
  "auth.logout": "退出",
  "auth.login_failed": "登录失败",
  "ai.chat.query": "AI 查询",
  "data.export.customers": "导出客户",
  "data.export.managers": "导出经理",
  "data.export.alerts": "导出预警",
  "alert.status.update": "预警状态变更",
  "access.denied": "拒绝访问",
}

export default function AuditPage() {
  const { user, loading } = useUser()
  const router = useRouter()

  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [actionFilter, setActionFilter] = useState("")
  const [fetching, setFetching] = useState(false)
  const [chainResult, setChainResult] = useState<{ valid: boolean; brokenAt?: string; checked: number } | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (!loading && user && !["branch_admin", "compliance"].includes(user.role)) {
      router.replace("/")
    }
  }, [user, loading, router])

  const fetchLogs = useCallback(async () => {
    setFetching(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(actionFilter ? { action: actionFilter } : {}),
      })
      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) throw new Error("请求失败")
      const data: AuditResponse = await res.json()
      setRows(data.rows)
      setTotal(data.total)
    } catch {
      toast.error("加载审计日志失败")
    } finally {
      setFetching(false)
    }
  }, [page, pageSize, actionFilter])

  useEffect(() => {
    if (user && ["branch_admin", "compliance"].includes(user.role)) {
      fetchLogs()
    }
  }, [fetchLogs, user])

  async function verifyChain() {
    setVerifying(true)
    try {
      const res = await fetch("/api/audit?verifyChain=true&pageSize=1")
      if (!res.ok) throw new Error("请求失败")
      const data: AuditResponse = await res.json()
      if (data.chainIntegrity) {
        setChainResult(data.chainIntegrity)
        if (data.chainIntegrity.valid) {
          toast.success(`哈希链完整，已验证 ${data.chainIntegrity.checked} 条记录`)
        } else {
          toast.error(`哈希链在 ${data.chainIntegrity.brokenAt ?? "未知位置"} 处断裂`)
        }
      }
    } catch {
      toast.error("验证失败")
    } finally {
      setVerifying(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  if (loading) return <div className="p-8 text-muted-foreground text-sm">加载中…</div>
  if (!user || !["branch_admin", "compliance"].includes(user.role)) return null

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">审计日志</h1>
          <span className="text-sm text-muted-foreground">共 {total} 条</span>
        </div>
        <div className="flex items-center gap-2">
          {chainResult && (
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${chainResult.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {chainResult.valid
                ? <><CheckCircle className="h-3.5 w-3.5" /> 链完整（{chainResult.checked} 条）</>
                : <><XCircle className="h-3.5 w-3.5" /> 链断裂于 {chainResult.brokenAt}</>}
            </div>
          )}
          <button
            onClick={verifyChain}
            disabled={verifying}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`} />
            验证链完整性
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全部操作</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button
          onClick={() => fetchLogs()}
          disabled={fetching}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">时间</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">操作人</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">角色</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">操作</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">摘要</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">数据范围</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fetching && rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">加载中…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">暂无记录</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{row.actor_name}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{row.actor_branch ?? "全行"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      row.action.startsWith("auth") ? "bg-blue-50 text-blue-700" :
                      row.action.startsWith("data.export") ? "bg-amber-50 text-amber-700" :
                      row.action === "access.denied" ? "bg-red-50 text-red-700" :
                      row.action.startsWith("ai") ? "bg-purple-50 text-purple-700" :
                      "bg-secondary text-secondary-foreground"
                    }`}>
                      {ACTION_LABELS[row.action] ?? row.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate" title={row.summary}>{row.summary}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{row.data_scope ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{row.ip_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>第 {page} / {totalPages} 页，共 {total} 条</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-40"
            >上一页</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-40"
            >下一页</button>
          </div>
        </div>
      )}
    </div>
  )
}
