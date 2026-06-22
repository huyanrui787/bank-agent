"use client"

import { AlertTriangle, BellRing, Banknote, Building2, Clock, MapPin, TrendingUp, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  alertTypeLabel,
  severityLabel,
  statusLabel,
} from "@/lib/mock/alerts"
import type { BusinessAlert } from "@/lib/mock/types"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

const iconByType = {
  deposit_due: Wallet,
  loan_due: Banknote,
  financing_growth: TrendingUp,
  financing_surge: AlertTriangle,
  new_property: Building2,
  grid_change: MapPin,
  branch_abnormal: BellRing,
} as const

const severityVariant = {
  info: "info",
  warning: "warning",
  critical: "critical",
} as const

const statusVariant = {
  pending: "muted",
  processing: "info",
  done: "success",
} as const

function daysUntil(dateStr: string): number {
  const today = new Date("2026-05-22")
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function AlertCard({
  alert,
  onClick,
  selected,
}: {
  alert: BusinessAlert
  onClick?: () => void
  selected?: boolean
}) {
  const Icon = iconByType[alert.type]
  const daysLeft = alert.dueDate ? daysUntil(alert.dueDate) : null
  const isUrgentDue = daysLeft !== null && daysLeft <= 15

  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm",
        selected && "border-primary ring-1 ring-primary/40",
        isUrgentDue && alert.status !== "done" && "border-amber-300"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            alert.severity === "critical" && "bg-red-50 text-red-600",
            alert.severity === "warning" && "bg-amber-50 text-amber-600",
            alert.severity === "info" && "bg-sky-50 text-sky-600"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{alert.title}</span>
            <Badge variant={severityVariant[alert.severity]}>{severityLabel[alert.severity]}</Badge>
            <Badge variant={statusVariant[alert.status]}>{statusLabel[alert.status]}</Badge>
            <Badge variant="outline">{alertTypeLabel[alert.type]}</Badge>
            {alert.type === "branch_abnormal" && (
              <Badge variant="critical" className="text-[10px]">总行层级</Badge>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{alert.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {alert.customerName ? <span>客户：{alert.customerName}</span> : null}
            {alert.managerName ? <span>经理：{alert.managerName}</span> : null}
            {alert.amount ? <span>金额：{formatCurrency(alert.amount, { compact: true })}</span> : null}
            {alert.dueDate ? (
              <span className={cn("flex items-center gap-1", isUrgentDue && alert.status !== "done" && "text-amber-600 font-medium")}>
                {isUrgentDue && alert.status !== "done" && <Clock className="h-3 w-3" />}
                到期：{formatDate(alert.dueDate)}
                {daysLeft !== null && (
                  <span className={cn(
                    "ml-1 px-1 rounded text-[10px]",
                    daysLeft <= 7 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {daysLeft <= 0 ? "已到期" : `${daysLeft}天后`}
                  </span>
                )}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  )
}
