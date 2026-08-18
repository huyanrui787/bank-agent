"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CopyIcon,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CashflowChart } from "@/components/cashflow-chart"
import type { CustomerProfile } from "@/lib/mock/types"
import type { AgentResponse } from "@/lib/agent/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { generateScript, type ScriptScene, type ScriptResult } from "@/lib/mock/scripts"

const examples = [
  "张明",
  "C001",
  "6101********1234",
  "高新区·锦园",
]

export default function AnalysisPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisPageInner />
    </Suspense>
  )
}

function AnalysisPageInner() {
  const search = useSearchParams()
  const initialId = search.get("id") ?? ""
  const [query, setQuery] = useState(initialId || "张明")
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    run(initialId || "张明")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(input?: string) {
    const message = (input ?? query).trim()
    if (!message) return
    setLoading(true)
    try {
      const res = await fetch("/api/mock-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `分析客户 ${message} 的风险情况，生成 360° 画像`,
        }),
      })
      if (!res.body) throw new Error("no body")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const line = chunk.startsWith("data:") ? chunk.slice(5).trim() : chunk.trim()
          if (!line) continue
          try {
            const event = JSON.parse(line)
            if (event.type === "done") {
              const data = event.response as AgentResponse
              if (data.resultType === "profile" || data.resultType === "report") {
                setProfile(data.data as CustomerProfile)
              } else if (data.data) {
                setProfile(data.data as CustomerProfile)
              } else {
                toast.error("未识别到客户，请尝试姓名 / 客户编号 / 身份证号 / 地址")
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">查询分析</h1>
          <p className="text-sm text-muted-foreground mt-1">
            输入客户身份信息或关键词，AI 一键产出 360° 客户画像、风险解释、调查报告。
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索：张三 / C001 / 6101********1234 / 高新区·锦园"
                className="pl-9"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    run()
                  }
                }}
              />
            </div>
            <Button onClick={() => run()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 spin-slow" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "分析中…" : "AI 分析"}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">示例查询：</span>
            {examples.map((e) => (
              <Badge
                key={e}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => {
                  setQuery(e)
                  run(e)
                }}
              >
                {e}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {profile ? <ProfileBlock profile={profile} /> : null}
    </div>
  )
}

function ProfileBlock({ profile }: { profile: CustomerProfile }) {
  const { customer, riskSignals, admissionResult, cashflowAnalysis, generatedReport, depositRecommendation, loanRecommendation, visitRecords } = profile

  const totalAssets = customer.avgDeposit
  const totalLiabilities = customer.mortgageLoan + customer.creditLoan
  const netInflow = cashflowAnalysis.netInflow

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-start gap-6 p-5">
          <div className="flex items-center gap-3 min-w-64">
            <div className="h-14 w-14 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xl font-medium">
              {customer.name[0]}
            </div>
            <div>
              <div className="text-lg font-semibold">{customer.name}</div>
              <div className="text-xs text-muted-foreground">编号 {customer.id} · {customer.idNoMasked}</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={customer.riskLevel === "high" ? "critical" : customer.riskLevel === "medium" ? "warning" : "success"}>
                  {customer.riskLevel === "high" ? "高风险" : customer.riskLevel === "medium" ? "中风险" : "低风险"}
                </Badge>
                <Badge variant="muted">
                  {customer.segment === "high_net_worth" ? "高净值" : customer.segment === "stock" ? "存量" : customer.segment === "potential" ? "扩中" : "新户"}
                </Badge>
                <Badge variant="outline">{customer.branch}</Badge>
                <Badge variant="outline">{customer.grid}</Badge>
              </div>
            </div>
          </div>

          <Separator orientation="vertical" className="hidden md:block h-20" />

          <ProfileStat label="日均存款" value={formatCurrency(totalAssets, { compact: true })} icon={Wallet} positive />
          <ProfileStat
            label="本行授信余额"
            value={formatCurrency(totalLiabilities, { compact: true })}
            icon={Wallet}
          />
          <ProfileStat
            label="月均净流入"
            value={formatCurrency(netInflow, { compact: true })}
            icon={ArrowUpRight}
            positive
          />
          <ProfileStat
            label="是否扩中客户"
            value={customer.segment === "potential" ? "是" : "否"}
            icon={Sparkles}
          />
          <ProfileStat
            label="行内有贷"
            value={customer.mortgageLoan + customer.creditLoan > 0 ? "是" : "否"}
            icon={Wallet}
          />
          <ProfileStat
            label="最近征信查询"
            value={customer.creditReportUpdatedAt ?? "未查询"}
            icon={FileText}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="risk">
        <TabsList>
          <TabsTrigger value="risk">风险与准入</TabsTrigger>
          <TabsTrigger value="cashflow">资金流分析</TabsTrigger>
          <TabsTrigger value="recommend">产品推荐</TabsTrigger>
          <TabsTrigger value="visits">走访记录</TabsTrigger>
          <TabsTrigger value="scripts">营销话术</TabsTrigger>
        </TabsList>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                风险信号
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {riskSignals.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={r.level === "critical" ? "critical" : r.level === "warning" ? "warning" : "info"}
                    >
                      {r.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{r.source}</span>
                  </div>
                  <div className="text-sm">{r.description}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {admissionResult.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                准入判断
              </CardTitle>
              <p className="text-xs text-muted-foreground">{admissionResult.conclusion}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {((admissionResult as unknown as { details?: import("@/lib/mock/admission-rules").AdmissionRuleDetail[] }).details ?? null)
                ? ((admissionResult as unknown as { details: import("@/lib/mock/admission-rules").AdmissionRuleDetail[] }).details).map((d) => (
                    <div key={d.category} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {d.status === "pass" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : d.status === "hit" ? (
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{d.categoryLabel}</span>
                        <Badge
                          variant={d.status === "pass" ? "success" : d.status === "hit" ? "critical" : "muted"}
                          className="ml-auto text-[10px]"
                        >
                          {d.status === "pass" ? "通过" : d.status === "hit" ? "命中" : "未知"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground pl-5">{d.summary}</p>
                      <div className="pl-5 space-y-1">
                        {d.rules.map((r) => (
                          <div key={r.code} className="flex items-start gap-1.5 text-xs">
                            {r.status === "pass" ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                            ) : r.status === "hit" ? (
                              <XCircle className="h-3 w-3 text-red-600 mt-0.5 shrink-0" />
                            ) : (
                              <div className="h-3 w-3 rounded-full border border-muted-foreground mt-0.5 shrink-0" />
                            )}
                            <div>
                              <span className="text-muted-foreground">{r.name}</span>
                              {r.status === "hit" && (
                                <span className="text-red-600 ml-1">— {r.detail}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                : admissionResult.rules.map((r) => (
                    <div key={r.code} className="flex items-start gap-2 text-sm">
                      {r.pass ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.name}</span>
                          <Badge variant="muted">{r.code}</Badge>
                        </div>
                        {r.note ? <div className="text-xs text-muted-foreground">{r.note}</div> : null}
                      </div>
                    </div>
                  ))
              }
            </CardContent>
          </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                AI 调查报告
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(generatedReport)
                  toast.success("调查报告已复制到剪贴板")
                }}
              >
                <CopyIcon className="h-3.5 w-3.5" />
                复制全文
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="text-xs leading-6 bg-muted/40 rounded-md p-4 whitespace-pre-wrap font-sans">
                {generatedReport}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashflow" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>近 6 个月资金流</CardTitle>
              <p className="text-xs text-muted-foreground">
                月均净流入 {formatCurrency(cashflowAnalysis.netInflow, { compact: true })}
              </p>
            </CardHeader>
            <CardContent>
              <CashflowChart data={cashflowAnalysis.monthlyTrend} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>上下游关系</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">主要上游</div>
                {cashflowAnalysis.upstream.map((u) => (
                  <div key={u.name} className="flex items-center justify-between">
                    <span>{u.name}</span>
                    <span className="text-muted-foreground">{formatCurrency(u.amount, { compact: true })}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div>
                <div className="text-xs text-muted-foreground mb-1">主要下游</div>
                {cashflowAnalysis.downstream.map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <span>{d.name}</span>
                    <span className="text-muted-foreground">{formatCurrency(d.amount, { compact: true })}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommend" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>存款 / 理财推荐</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {depositRecommendation.map((p) => (
                <ProductRow key={p.productCode} p={p} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>贷款推荐</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loanRecommendation.map((p) => (
                <ProductRow key={p.productCode} p={p} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits">
          <Card>
            <CardHeader>
              <CardTitle>历史走访记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visitRecords.map((v) => (
                <div key={v.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(v.visitedAt)}</span>
                    <span>·</span>
                    <Badge variant="muted">{v.channel}</Badge>
                    <span>·</span>
                    <span>{v.manager}</span>
                  </div>
                  <div className="text-sm mt-1">{v.summary}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scripts">
          <ScriptsPanel customer={customer} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProfileStat({
  label,
  value,
  icon: Icon,
  positive,
}: {
  label: string
  value: string
  icon: typeof Wallet
  positive?: boolean
}) {
  return (
    <div className="flex items-start gap-2 min-w-36">
      <div className={`flex h-9 w-9 items-center justify-center rounded-md ${positive ? "bg-emerald-50 text-emerald-600" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold mt-0.5">{value}</div>
      </div>
    </div>
  )
}

function ProductRow({ p }: { p: { productCode: string; productName: string; matchReason: string; expectedRate: string; riskHint?: string } }) {
  return (
    <div className="rounded-md border border-border p-3 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{p.productName}</span>
          <Badge variant="outline">{p.productCode}</Badge>
        </div>
        <span className="text-xs text-emerald-600 font-medium">{p.expectedRate}</span>
      </div>
      <div className="text-xs text-muted-foreground">{p.matchReason}</div>
      {p.riskHint ? <div className="text-xs text-amber-600 inline-flex items-center gap-1">
        <ArrowDownRight className="h-3 w-3" /> 风险提示：{p.riskHint}
      </div> : null}
    </div>
  )
}

const scriptScenes: ScriptScene[] = ["营销", "催收", "续存", "转介绍"]

function ScriptsPanel({ customer }: { customer: CustomerProfile["customer"] }) {
  const [scene, setScene] = useState<ScriptScene>("营销")
  const baseScript = useMemo(() => generateScript(customer, scene), [customer, scene])
  const [script, setScript] = useState<ScriptResult>(baseScript)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    setScript(baseScript)
  }, [baseScript])

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const res = await fetch("/api/mock-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `为${customer.name}生成${scene}话术`,
          forceMock: true,
        }),
      })
      const data = (await res.json()) as AgentResponse
      if (data.data && "content" in (data.data as Record<string, unknown>)) {
        setScript(data.data as unknown as ScriptResult)
      } else {
        setScript(generateScript(customer, scene))
      }
      toast.success("话术已更新")
    } catch {
      toast.error("生成失败，请稍后重试")
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {script.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? <Loader2 className="h-3.5 w-3.5 spin-slow" /> : <Sparkles className="h-3.5 w-3.5" />}
              {regenerating ? "生成中…" : "重新生成"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(script.content)
                toast.success("话术已复制到剪贴板")
              }}
            >
              <CopyIcon className="h-3.5 w-3.5" />
              复制话术
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="text-sm leading-7 bg-muted/40 rounded-md p-4 whitespace-pre-wrap font-sans">
            {script.content}
          </pre>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">场景选择</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {scriptScenes.map((s) => (
              <Badge
                key={s}
                variant={s === scene ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setScene(s)}
              >
                {s}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">客户分级</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">五级分类</span>
              <Badge variant={script.grade === "正常" ? "success" : script.grade === "关注" ? "warning" : "critical"}>
                {script.grade}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">推荐渠道</span>
              <span>{script.channel}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">沟通技巧</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {script.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>{tip}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
