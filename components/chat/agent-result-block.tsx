"use client"

import Link from "next/link"
import {
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCard } from "@/components/alert-card"
import { ManagerRanking } from "@/components/manager-ranking"
import { CustomerTable } from "@/components/customer-table"
import { ChartBlock } from "@/components/chat/chart-block"
import type { AgentResponse } from "@/lib/agent/types"
import type { BusinessAlert, Customer, Manager } from "@/lib/mock/types"

export function intentLabel(intent: AgentResponse["intent"]) {
  return ({
    customer_segment: "客群梳理",
    vertical_management: "垂直管理",
    business_alert: "业务预警",
    customer_analysis: "客户分析",
    generate_report: "报告生成",
    generate_script: "话术生成",
    query_database: "数据查询",
    export_data: "数据导出",
    unknown: "未识别意图",
  } as Record<string, string>)[intent] ?? intent
}

export function AgentBadge({ agent }: { agent: string }) {
  if (agent === "mock") return <Badge variant="muted">本地 Mock</Badge>
  if (agent === "mock-fallback") return <Badge variant="warning">Mock 兜底</Badge>
  return (
    <Badge variant="success">
      <Sparkles className="h-3 w-3" />
      LLM · {agent}
    </Badge>
  )
}

export function AgentResultBlock({ response }: { response: AgentResponse }) {
  if (response.resultType === "empty") {
    return null
  }

  if (response.resultType === "chart") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>数据分析图表</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartBlock data={response.data as Parameters<typeof ChartBlock>[0]["data"]} />
        </CardContent>
      </Card>
    )
  }

  if (response.resultType === "table" && response.intent === "customer_segment") {
    const data = response.data as Customer[]
    return (
      <Card>
        <CardHeader>
          <CardTitle>客户清单</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerTable
            data={data}
            toolbarRight={
              <div className="flex items-center gap-2">
                <Button asChild size="sm">
                  <a href="/api/export?type=customers&format=xlsx" download>
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    导出 Excel
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href="/api/export?type=customers&format=csv" download>
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </a>
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    )
  }

  if (response.resultType === "alert") {
    const data = response.data as BusinessAlert[]
    return (
      <Card>
        <CardHeader>
          <CardTitle>业务预警</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.slice(0, 6).map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (response.resultType === "report" || response.resultType === "profile") {
    const profile = response.data as {
      customer: Customer
      generatedReport: string
      riskSignals: { id: string; description: string }[]
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>客户画像 / 调查报告</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">基础信息</div>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>姓名：{profile.customer.name}</li>
              <li>客户经理：{profile.customer.managerName}</li>
              <li>所在小区：{profile.customer.community}</li>
              <li>风险等级：{profile.customer.riskLevel}</li>
            </ul>
            <div className="flex items-center gap-2 pt-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/analysis?id=${profile.customer.id}`}>
                  <FileText className="h-3.5 w-3.5" />
                  打开完整画像
                </Link>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">报告预览</div>
            <pre className="text-xs leading-5 bg-muted/50 rounded-md p-3 max-h-60 overflow-auto scrollbar-thin whitespace-pre-wrap">
              {profile.generatedReport.slice(0, 800)}
            </pre>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (response.resultType === "file") {
    const file = response.data as { url: string; filename: string; format?: string }
    const isXlsx = file.format === "xlsx" || file.filename.endsWith(".xlsx")
    return (
      <Card>
        <CardHeader>
          <CardTitle>可导出文件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button asChild>
              <a href={file.url} download={file.filename}>
                {isXlsx ? <FileSpreadsheet className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                下载 {file.filename}
              </a>
            </Button>
            {isXlsx ? (
              <Button asChild variant="outline">
                <a href={file.url.replace("format=xlsx", "format=csv")} download>
                  <Download className="h-4 w-4" />
                  改用 CSV
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <a href={file.url.replace("format=csv", "format=xlsx")} download>
                  <FileSpreadsheet className="h-4 w-4" />
                  改用 Excel
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (response.resultType === "table" && response.intent === "vertical_management") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>经理绩效排名</CardTitle>
        </CardHeader>
        <CardContent>
          <ManagerRanking managers={(response.data as Manager[]) ?? []} />
        </CardContent>
      </Card>
    )
  }

  return null
}
