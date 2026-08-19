"use client"

import { useMemo, useState } from "react"
import { Download, FileSpreadsheet, Filter, Layers, Search, BarChart2 } from "lucide-react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerTable } from "@/components/customer-table"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { customers } from "@/lib/mock/customers"

type TemplateId = "all" | "high-deposit" | "low-loan-high-credit" | "contract-unused" | "credit-updated" | "no-bank-other"

const templates: { id: TemplateId; name: string; desc: string }[] = [
  { id: "all", name: "全量客户", desc: "不应用任何条件，可作为起点" },
  { id: "high-deposit", name: "高日均存款客户", desc: "小区/网格 + 日均存款 ≥ 指定金额" },
  { id: "low-loan-high-credit", name: "低贷高信客户", desc: "抵押贷款 > X 且 信用贷款 < Y（金额可自定义）" },
  { id: "contract-unused", name: "有合同未用信", desc: "有效合同 且 当前用信为 0" },
  { id: "credit-updated", name: "近期征信更新", desc: "近一年征信报告更新时间不为空" },
  { id: "no-bank-other", name: "无贷有贷（他行）", desc: "本行无贷，但他行有贷" },
]

export default function CustomerSegmentsPage() {
  const [template, setTemplate] = useState<TemplateId>("high-deposit")
  const [minDeposit, setMinDeposit] = useState(100_000)
  const [community, setCommunity] = useState<string>("all")
  const [minMortgage, setMinMortgage] = useState(500_000)
  const [maxCredit, setMaxCredit] = useState(80_000)

  const communities = useMemo(
    () => Array.from(new Set(customers.map((c) => c.community))),
    []
  )

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (community !== "all" && c.community !== community) return false
      switch (template) {
        case "high-deposit":
          return c.avgDeposit >= minDeposit
        case "low-loan-high-credit":
          return c.mortgageLoan >= minMortgage && c.creditLoan <= maxCredit
        case "contract-unused":
          return c.hasValidContract && c.usedCreditAmount === 0
        case "credit-updated":
          return !!c.creditReportUpdatedAt
        case "no-bank-other":
          return c.hasOtherBankLoan && c.mortgageLoan === 0 && c.creditLoan === 0
        default:
          return true
      }
    })
  }, [template, minDeposit, community, minMortgage, maxCredit])

  const riskDist = useMemo(() => {
    const map: Record<string, number> = { low: 0, medium: 0, high: 0 }
    filtered.forEach((c) => { map[c.riskLevel] = (map[c.riskLevel] ?? 0) + 1 })
    return [
      { name: "低风险", value: map.low,    fill: "#16a34a" },
      { name: "中风险", value: map.medium, fill: "#d97706" },
      { name: "高风险", value: map.high,   fill: "#dc2626" },
    ].filter((d) => d.value > 0)
  }, [filtered])

  const segmentDist = useMemo(() => {
    const labels: Record<string, string> = {
      high_net_worth: "高净值", stock: "存量", potential: "潜力", new: "新客",
    }
    const map: Record<string, number> = {}
    filtered.forEach((c) => { map[c.segment] = (map[c.segment] ?? 0) + 1 })
    return Object.entries(map).map(([k, v]) => ({ name: labels[k] ?? k, value: v }))
  }, [filtered])

  const depositDist = useMemo(() => {
    const buckets = [
      { name: "< 5万",   min: 0,       max: 50_000 },
      { name: "5-20万",  min: 50_000,  max: 200_000 },
      { name: "20-50万", min: 200_000, max: 500_000 },
      { name: "> 50万",  min: 500_000, max: Infinity },
    ]
    return buckets.map((b) => ({
      name: b.name,
      count: filtered.filter((c) => c.avgDeposit >= b.min && c.avgDeposit < b.max).length,
    }))
  }, [filtered])

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">客群梳理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            预置筛选模板 + 自定义条件，秒级生成可执行客户清单。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <a href="/api/export?type=customers&format=xlsx" download>
              <FileSpreadsheet className="h-4 w-4" /> 导出全量 Excel
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/export?type=customers&format=csv" download>
              <Download className="h-4 w-4" /> CSV
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            预置筛选模板
          </CardTitle>
          <p className="text-xs text-muted-foreground">选择模板后可在下方继续微调条件。</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {templates.map((t) => {
            const active = template === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id)}
                className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/30 hover:bg-accent/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{t.name}</div>
                  {active ? <Badge variant="info">已选</Badge> : null}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            自定义筛选器
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            条件实时生效，结果同步刷新下方表格。
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">小区 / 网格</label>
              <Select value={community} onValueChange={setCommunity}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部小区</SelectItem>
                  {communities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {template === "high-deposit" ? (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">日均存款下限</label>
                <div className="relative">
                  <Input
                    type="number"
                    value={minDeposit}
                    onChange={(e) => setMinDeposit(Number(e.target.value) || 0)}
                    className="w-44 pl-8"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">¥</span>
                </div>
              </div>
            ) : null}
            {template === "low-loan-high-credit" ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">抵押贷款超过（元）</label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={minMortgage}
                      onChange={(e) => setMinMortgage(Number(e.target.value) || 0)}
                      className="w-44 pl-8"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">¥</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">信用贷款小于（元）</label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={maxCredit}
                      onChange={(e) => setMaxCredit(Number(e.target.value) || 0)}
                      className="w-44 pl-8"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">¥</span>
                  </div>
                </div>
              </>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="muted">
                <Search className="h-3 w-3" /> 命中 {filtered.length} 位
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            客群分布统计
          </CardTitle>
          <p className="text-xs text-muted-foreground">基于当前筛选结果实时计算，共 {filtered.length} 位客户。</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Risk distribution pie */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 text-center">风险等级分布</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {riskDist.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} 人`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Segment distribution pie */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 text-center">客群分类分布</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={segmentDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {segmentDist.map((_, i) => (
                      <Cell key={i} fill={["#1e40af","#16a34a","#d97706","#7c3aed"][i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} 人`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Deposit range bar */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 text-center">日均存款区间分布</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={depositDist} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`${v} 人`, "客户数"]} />
                  <Bar dataKey="count" fill="#1e40af" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>客户清单</CardTitle>
          <p className="text-xs text-muted-foreground">
            支持关键词搜索、风险等级筛选、客户经理筛选、列排序、分页与多选。
          </p>
        </CardHeader>
        <CardContent>
          <CustomerTable
            data={filtered}
            toolbarRight={
              <div className="flex items-center gap-2">
                <Button asChild size="sm">
                  <a href="/api/export?type=customers&format=xlsx" download>
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="/api/export?type=customers&format=csv" download>
                    <Download className="h-3.5 w-3.5" /> CSV
                  </a>
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
