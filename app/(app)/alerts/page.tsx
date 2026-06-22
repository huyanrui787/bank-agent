"use client"

import { useMemo, useState } from "react"
import { Clock, Download, FileSpreadsheet, Filter, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { AlertCard } from "@/components/alert-card"
import { AlertDetailDrawer } from "@/components/alert-detail-drawer"
import { alerts as initialAlerts, alertTypeLabel } from "@/lib/mock/alerts"
import type { AlertStatus, BusinessAlert } from "@/lib/mock/types"

function daysUntil(dateStr: string): number {
  const today = new Date("2026-05-22")
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function AlertsPage() {
  const [items, setItems] = useState<BusinessAlert[]>(initialAlerts)
  const [keyword, setKeyword] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewTab, setViewTab] = useState<"all" | "due_soon" | "branch">("all")
  const [active, setActive] = useState<BusinessAlert | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    return items.filter((a) => {
      // 快速视图 Tab
      if (viewTab === "due_soon") {
        if (!a.dueDate) return false
        if (daysUntil(a.dueDate) > 15) return false
      }
      if (viewTab === "branch") {
        if (a.type !== "branch_abnormal") return false
      }
      if (typeFilter !== "all" && a.type !== typeFilter) return false
      if (severityFilter !== "all" && a.severity !== severityFilter) return false
      if (statusFilter !== "all" && a.status !== statusFilter) return false
      if (keyword) {
        const lower = keyword.trim()
        if (!lower) return true
        return [a.title, a.customerName, a.managerName, a.description]
          .filter(Boolean)
          .some((field) => (field as string).includes(lower))
      }
      return true
    })
  }, [items, keyword, typeFilter, severityFilter, statusFilter, viewTab])

  const stats = useMemo(() => {
    const total = items.length
    const critical = items.filter((a) => a.severity === "critical").length
    const pending = items.filter((a) => a.status === "pending").length
    const done = items.filter((a) => a.status === "done").length
    const dueSoon = items.filter(
      (a) => a.dueDate && daysUntil(a.dueDate) <= 15 && a.status !== "done"
    ).length
    return { total, critical, pending, done, dueSoon }
  }, [items])

  async function updateStatus(id: string, status: AlertStatus) {
    const prev = items.find((a) => a.id === id)
    if (!prev) return
    // Optimistic update
    setItems((curr) => curr.map((a) => (a.id === id ? { ...a, status } : a)))
    try {
      const res = await fetch(`/api/alerts/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("请求失败")
      toast.success("状态已更新")
    } catch {
      // Rollback on error
      setItems((curr) => curr.map((a) => (a.id === id ? prev : a)))
      toast.error("更新失败，请重试")
    }
  }

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">业务预警</h1>
          <p className="text-sm text-muted-foreground mt-1">
            主动扫描存贷、融资、网格、支行多源数据，AI 给出可执行建议。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <a href="/api/export?type=alerts&format=xlsx" download>
              <FileSpreadsheet className="h-4 w-4" /> 导出预警 Excel
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/export?type=alerts&format=csv" download>
              <Download className="h-4 w-4" /> CSV
            </a>
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatBox label="预警总数" value={stats.total} />
        <StatBox label="紧急" value={stats.critical} accent="critical" />
        <StatBox label="待处理" value={stats.pending} accent="warning" />
        <StatBox label="半月内到期" value={stats.dueSoon} accent="warning" icon />
        <StatBox label="已完成" value={stats.done} accent="success" />
      </section>

      {/* 快速视图 Tab */}
      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as typeof viewTab)}>
        <TabsList>
          <TabsTrigger value="all">全部预警</TabsTrigger>
          <TabsTrigger value="due_soon" className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            半月内到期
            {stats.dueSoon > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 leading-none">
                {stats.dueSoon}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="branch">支行异常（总行层级）</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">关键词</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="客户 / 经理 / 标题 / 描述"
                  className="pl-8 w-72"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">预警类型</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {Object.entries(alertTypeLabel).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">严重度</label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="critical">紧急</SelectItem>
                  <SelectItem value="warning">关注</SelectItem>
                  <SelectItem value="info">提示</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">状态</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="processing">处理中</SelectItem>
                  <SelectItem value="done">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto">
              <Badge variant="muted">命中 {filtered.length} 条</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((a) => (
          <AlertCard
            key={a.id}
            alert={a}
            selected={active?.id === a.id}
            onClick={() => { setActive(a); setOpen(true) }}
          />
        ))}
        {filtered.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="text-center text-sm text-muted-foreground py-10">
              无匹配的预警，可尝试放宽筛选条件
            </CardContent>
          </Card>
        )}
      </section>

      <AlertDetailDrawer
        alert={active}
        open={open}
        onOpenChange={setOpen}
        onStatusChange={updateStatus}
      />
    </div>
  )
}

function StatBox({
  label,
  value,
  accent,
  icon,
}: {
  label: string
  value: number
  accent?: "critical" | "warning" | "success"
  icon?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon && <Clock className="h-3 w-3 text-amber-500" />}
          {label}
        </div>
        <div
          className={`text-2xl font-semibold mt-1 ${
            accent === "critical"
              ? "text-red-600"
              : accent === "warning"
              ? "text-amber-600"
              : accent === "success"
              ? "text-emerald-600"
              : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
