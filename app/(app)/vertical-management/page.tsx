"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ListChecks,
  Medal,
  Search,
  TrendingUp,
  UserPlus2,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ManagerRanking } from "@/components/manager-ranking"
import { formatCurrency, formatDate } from "@/lib/utils"
import type { Manager, Customer } from "@/lib/mock/types"

export default function VerticalManagementPage() {
  const [importStatus, setImportStatus] = useState<"idle" | "imported" | "assigned">("idle")
  const [drillManager, setDrillManager] = useState<Manager | null>(null)
  const [rankBy, setRankBy] = useState<"deposit" | "loan">("deposit")
  const [filterManager, setFilterManager] = useState("all")
  const [managerSearch, setManagerSearch] = useState("")
  const [selectedMonth, setSelectedMonth] = useState("2026-05")
  const [managers, setManagers] = useState<Manager[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  useEffect(() => {
    fetch("/api/managers")
      .then((r) => r.json())
      .then((d) => setManagers(d.managers ?? []))
      .catch(() => setManagers([]))
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers ?? []))
      .catch(() => setCustomers([]))
  }, [])

  const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]

  // 按月份取经理数据
  function getMonthData(m: Manager) {
    const d = m.monthlyData?.[selectedMonth]
    if (!d) return {
      depositIncrease: m.monthlyDepositIncrease,
      loanIncrease: m.monthlyLoanIncrease,
      newCustomers: m.monthlyNewCustomers,
      vsLastMonthDeposit: m.vsLastMonthDeposit,
      vsLastMonthLoan: m.vsLastMonthLoan,
    }
    return d
  }

  // 按存款/贷款增量排序，前十高亮，支持搜索过滤
  const rankedManagers = useMemo(() => {
    const sorted = [...managers].sort((a, b) => {
      const da = getMonthData(a)
      const db = getMonthData(b)
      return rankBy === "deposit"
        ? db.depositIncrease - da.depositIncrease
        : db.loanIncrease - da.loanIncrease
    })
    return sorted
      .map((m, idx) => ({ ...m, rank: idx + 1, md: getMonthData(m) }))
      .filter((m) =>
        managerSearch.trim() === "" ||
        m.name.includes(managerSearch.trim()) ||
        m.branch.includes(managerSearch.trim()) ||
        m.grid.includes(managerSearch.trim())
      )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankBy, managerSearch, selectedMonth, managers])

  const importStats = {
    file: "支行客户名单_2026_06.xlsx",
    total: 248,
    assignable: 226,
    matched: 198,
    manualReview: 28,
  }

  const newCustomers = customers.slice(0, 8)

  // 经理下钻：今年新引入客户
  const drillCustomers = useMemo(() => {
    if (!drillManager) return []
    return customers.filter(
      (c) => c.managerName === drillManager.name && c.introducedAt
    )
  }, [drillManager, customers])

  // 本月新增存贷客户清单（按经理筛选）
  const newDepositCustomers = useMemo(() => {
    const list = customers.filter((c) => c.avgDeposit > 0)
    if (filterManager === "all") return list.slice(0, 30)
    return list.filter((c) => c.managerName === filterManager).slice(0, 30)
  }, [filterManager, customers])

  // 扩中客群贷款统计（含本月新增贷款）
  const potentialLoanStats = useMemo(() => {
    return managers.map((m) => {
      const potentialCustomers = customers.filter(
        (c) => c.managerName === m.name && c.segment === "potential"
      )
      const totalLoan = potentialCustomers.reduce(
        (s, c) => s + c.mortgageLoan + c.creditLoan,
        0
      )
      const count = potentialCustomers.length
      // Mock 上月数据：随机波动
      const seed = m.id.charCodeAt(1)
      const lastMonthLoan = totalLoan * (0.85 + (seed % 20) * 0.01)
      const change = ((totalLoan - lastMonthLoan) / Math.max(lastMonthLoan, 1)) * 100
      // 本月新增贷款 = 经理整体新增贷款 × 扩中客户占比（Mock 估算）
      const ratio = count / Math.max(m.currentCustomerCount, 1)
      const newLoan = Math.round(m.monthlyLoanIncrease * ratio)
      const vsLastMonthNewLoan = m.vsLastMonthLoan
      return { manager: m, count, totalLoan, change, newLoan, vsLastMonthNewLoan }
    }).sort((a, b) => b.newLoan - a.newLoan)
  }, [managers, customers])

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">客户经理垂直管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            支行视角的客户经理绩效、新增贡献与名单分配。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <a href="/api/export?type=managers&format=xlsx" download>
              <FileSpreadsheet className="h-4 w-4" /> 导出经理绩效 Excel
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/api/export?type=managers&format=csv" download>
              <Download className="h-4 w-4" /> CSV
            </a>
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">本月新增客户合计</div>
            <div className="text-2xl font-semibold mt-1">
              {managers.reduce((s, m) => s + m.monthlyNewCustomers, 0)}
            </div>
            <div className="text-xs text-emerald-600 mt-1 inline-flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> 较上月 +14.2%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">本月新增存款合计</div>
            <div className="text-2xl font-semibold mt-1">
              {formatCurrency(managers.reduce((s, m) => s + m.monthlyDepositIncrease, 0), { compact: true })}
            </div>
            <div className="text-xs text-emerald-600 mt-1 inline-flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> 较上月 +9.8%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">本月新增贷款合计</div>
            <div className="text-2xl font-semibold mt-1">
              {formatCurrency(managers.reduce((s, m) => s + m.monthlyLoanIncrease, 0), { compact: true })}
            </div>
            <div className="text-xs text-red-600 mt-1 inline-flex items-center gap-1">
              <ArrowDownRight className="h-3 w-3" /> 较上月 -1.4%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">维护得分均值</div>
            <div className="text-2xl font-semibold mt-1">
              {(managers.reduce((s, m) => s + m.maintenanceScore, 0) / managers.length).toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">满分 100 · 综合走访、续存、问题响应</div>
          </CardContent>
        </Card>
      </section>

      {/* 图表 + 导入 */}
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              本月客户经理贡献
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ManagerRanking managers={managers} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              支行客户名单导入
            </CardTitle>
            <p className="text-xs text-muted-foreground">支持 Excel/CSV，AI 自动按网格、负荷分配客户经理。</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant={importStatus === "idle" ? "default" : "outline"}
              onClick={() => {
                setImportStatus("imported")
                toast.success(`已读取 ${importStats.file}，共 ${importStats.total} 位客户`)
              }}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {importStatus === "idle" ? "导入支行客户清单" : "重新导入"}
            </Button>

            {importStatus !== "idle" && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
                <div>当前文件：<span className="font-mono">{importStats.file}</span></div>
                <ImportStat label="总客户数" value={importStats.total} />
                <ImportStat label="可分配客户" value={importStats.assignable} />
                <ImportStat label="AI 已匹配经理" value={importStats.matched} progress={(importStats.matched / importStats.total) * 100} />
                <ImportStat label="待人工确认" value={importStats.manualReview} />
                <Button
                  className="w-full mt-2"
                  size="sm"
                  onClick={() => { setImportStatus("assigned"); toast.success("AI 已完成自动分配，可在下方查看") }}
                  disabled={importStatus === "assigned"}
                >
                  <UserPlus2 className="h-3.5 w-3.5" />
                  {importStatus === "assigned" ? "已自动分配" : "AI 自动分配客户经理"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 自动分配结果 */}
      {importStatus === "assigned" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              AI 自动分配结果（节选）
            </CardTitle>
            <p className="text-xs text-muted-foreground">已根据网格、客户经理工作负荷、维护得分综合分配。</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>客户</TableHead>
                  <TableHead>所在网格</TableHead>
                  <TableHead>预分配经理</TableHead>
                  <TableHead>当前管户数</TableHead>
                  <TableHead>分配理由</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newCustomers.map((c, i) => {
                  const m = managers[i % managers.length]
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.community}</span>
                        </div>
                      </TableCell>
                      <TableCell>{c.grid}</TableCell>
                      <TableCell>{m.name}</TableCell>
                      <TableCell>{m.currentCustomerCount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        网格匹配 · 工作负荷低于均值 · 维护得分 {m.maintenanceScore}
                      </TableCell>
                      <TableCell>
                        <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> 已分配</Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 多 Tab 详细数据 */}
      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">经理绩效排名</TabsTrigger>
          <TabsTrigger value="new-customers">本月新增存贷客户</TabsTrigger>
          <TabsTrigger value="potential">扩中客群贷款</TabsTrigger>
        </TabsList>

        {/* Tab 1：经理绩效排名（含前十高亮） */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  全量客户经理存贷数据
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={managerSearch}
                      onChange={(e) => setManagerSearch(e.target.value)}
                      placeholder="搜索经理 / 支行 / 网格"
                      className="pl-8 h-7 w-48 text-xs"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">月份：</span>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">排名依据：</span>
                  <Select value={rankBy} onValueChange={(v) => setRankBy(v as "deposit" | "loan")}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">存款增量</SelectItem>
                      <SelectItem value="loan">贷款增量</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedMonth} · 按{rankBy === "deposit" ? "存款" : "贷款"}增量排序，前十名高亮标注。点击「查看客户」可下钻今年新引入客户清单。
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">排名</TableHead>
                    <TableHead>客户经理</TableHead>
                    <TableHead>支行 / 网格</TableHead>
                    <TableHead>管户数</TableHead>
                    <TableHead>本月新增客户</TableHead>
                    <TableHead>本月新增存款</TableHead>
                    <TableHead>较上月</TableHead>
                    <TableHead>本月新增贷款</TableHead>
                    <TableHead>较上月</TableHead>
                    <TableHead>维护得分</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedManagers.map((m) => {
                    const isTop10 = m.rank <= 10
                    const isTop3 = m.rank <= 3
                    return (
                      <TableRow key={m.id} className={isTop10 ? (isTop3 ? "bg-amber-50/50" : "bg-sky-50/30") : ""}>
                        <TableCell>
                          {isTop10 ? (
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${m.rank === 1 ? "bg-amber-500" : m.rank === 2 ? "bg-slate-400" : m.rank === 3 ? "bg-amber-700" : "bg-sky-400"}`}>
                              {m.rank}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{m.rank}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-medium">
                              {m.name[0]}
                            </div>
                            <div>
                              <span className="font-medium">{m.name}</span>
                              {isTop10 && (
                                <Badge variant={isTop3 ? "warning" : "info"} className="ml-1.5 text-[10px] py-0">
                                  <Medal className="h-2.5 w-2.5" />
                                  {rankBy === "deposit" ? "存款" : "贷款"} Top{m.rank}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{m.branch}</span>
                            <span className="text-xs text-muted-foreground">{m.grid}</span>
                          </div>
                        </TableCell>
                        <TableCell>{m.currentCustomerCount}</TableCell>
                        <TableCell>{m.md.newCustomers}</TableCell>
                        <TableCell className={rankBy === "deposit" && isTop10 ? "font-semibold" : ""}>
                          {formatCurrency(m.md.depositIncrease, { compact: true })}
                        </TableCell>
                        <TableCell><Delta value={m.md.vsLastMonthDeposit} /></TableCell>
                        <TableCell className={rankBy === "loan" && isTop10 ? "font-semibold" : ""}>
                          {formatCurrency(m.md.loanIncrease, { compact: true })}
                        </TableCell>
                        <TableCell><Delta value={m.md.vsLastMonthLoan} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 w-32">
                            <Progress value={m.maintenanceScore} />
                            <span className="text-xs">{m.maintenanceScore}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setDrillManager(m)}>
                            查看客户
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2：本月新增存贷客户清单 */}
        <TabsContent value="new-customers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  本月新增存贷客户清单
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">筛选经理：</span>
                  <Select value={filterManager} onValueChange={setFilterManager}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部经理</SelectItem>
                      {managers.map((m) => (
                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                    <a href="/api/export?type=customers&format=xlsx" download>
                      <Download className="h-3 w-3" /> 导出
                    </a>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">含存款金额、存款期限、绩效维护人字段。</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>客户姓名</TableHead>
                    <TableHead>身份证号</TableHead>
                    <TableHead>小区 / 网格</TableHead>
                    <TableHead>日均存款</TableHead>
                    <TableHead>存款期限</TableHead>
                    <TableHead>贷款余额</TableHead>
                    <TableHead>绩效维护人</TableHead>
                    <TableHead>引入时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newDepositCustomers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{c.idNoMasked}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs">{c.community}</span>
                          <span className="text-xs text-muted-foreground">{c.grid}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(c.avgDeposit, { compact: true })}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{c.depositTerm ?? "活期"}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.mortgageLoan + c.creditLoan > 0
                          ? formatCurrency(c.mortgageLoan + c.creditLoan, { compact: true })
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{c.performanceOwner ?? c.managerName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.introducedAt ? formatDate(c.introducedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3：扩中客群贷款统计 */}
        <TabsContent value="potential">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                各客户经理扩中客群新增贷款情况
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                统计各经理名下扩中（potential）客户本月新增贷款，对比上月变化，按新增贷款排序。
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>客户经理</TableHead>
                    <TableHead>支行 / 网格</TableHead>
                    <TableHead>扩中客户数</TableHead>
                    <TableHead>本月新增贷款</TableHead>
                    <TableHead>较上月</TableHead>
                    <TableHead>贷款余额合计</TableHead>
                    <TableHead>维护得分</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {potentialLoanStats.map(({ manager: m, count, totalLoan, newLoan, vsLastMonthNewLoan }) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-medium">
                            {m.name[0]}
                          </div>
                          <span className="font-medium">{m.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{m.branch}</span>
                          <span className="text-xs text-muted-foreground">{m.grid}</span>
                        </div>
                      </TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell className="font-medium">
                        {newLoan > 0 ? formatCurrency(newLoan, { compact: true }) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {newLoan > 0 ? <Delta value={vsLastMonthNewLoan} /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {totalLoan > 0 ? formatCurrency(totalLoan, { compact: true }) : <span>—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 w-28">
                          <Progress value={m.maintenanceScore} />
                          <span className="text-xs">{m.maintenanceScore}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 经理下钻 Dialog */}
      <Dialog open={!!drillManager} onOpenChange={(o) => { if (!o) setDrillManager(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {drillManager?.name} · 今年新引入客户清单
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                共 {drillCustomers.length} 位客户，引入时间范围：2026-01-01 至今
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                <a href="/api/export?type=customers&format=xlsx" download>
                  <Download className="h-3 w-3" /> 导出 Excel
                </a>
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>客户姓名</TableHead>
                  <TableHead>身份证号</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>引入时间</TableHead>
                  <TableHead>是否有效客户</TableHead>
                  <TableHead>日均存款</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      暂无今年新引入客户记录
                    </TableCell>
                  </TableRow>
                ) : (
                  drillCustomers.slice(0, 20).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{c.idNoMasked}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.phoneMasked}</TableCell>
                      <TableCell className="text-xs">{c.introducedAt ? formatDate(c.introducedAt) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.hasValidContract ? "success" : "muted"}>
                          {c.hasValidContract ? "有效" : "待激活"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(c.avgDeposit, { compact: true })}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ImportStat({ label, value, progress }: { label: string; value: number; progress?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      {typeof progress === "number" ? <Progress value={progress} /> : null}
    </div>
  )
}

function Delta({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${positive ? "text-emerald-600" : "text-red-600"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  )
}
