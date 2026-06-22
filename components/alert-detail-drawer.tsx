"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, MessageCircle, Send, UserPlus2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import { alertTypeLabel, severityLabel, statusLabel } from "@/lib/mock/alerts"
import type { BusinessAlert, AlertStatus } from "@/lib/mock/types"
import type { WechatPushRecord } from "@/lib/mock/wechat"
import { formatCurrency, formatDate, relativeDays } from "@/lib/utils"

export function AlertDetailDrawer({
  alert,
  open,
  onOpenChange,
  onStatusChange,
}: {
  alert: BusinessAlert | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange?: (id: string, status: AlertStatus) => void
}) {
  const [script, setScript] = useState<string | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushRecords, setPushRecords] = useState<WechatPushRecord[]>([])

  if (!alert) return null

  const updateStatus = (status: AlertStatus) => {
    onStatusChange?.(alert.id, status)
    toast.success(`已将 ${alert.id} 标记为${statusLabel[status]}`)
  }

  const generateScript = () => {
    const tpl = scriptFor(alert)
    setScript(tpl)
    toast.success("AI 已为你生成沟通话术")
  }

  const pushToWechat = async () => {
    setPushing(true)
    try {
      const res = await fetch("/api/wechat-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertId: alert.id,
          alertTitle: alert.title,
          customerName: alert.customerName,
          managerName: alert.managerName,
          suggestedAction: alert.suggestedAction,
        }),
      })
      const data = await res.json() as { success: boolean; record: WechatPushRecord }
      if (data.success) {
        setPushRecords((prev) => [data.record, ...prev])
        toast.success(`已推送至企业微信：${data.record.recipients.join("、")}`)
      }
    } catch {
      toast.error("推送失败，请重试")
    } finally {
      setPushing(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <div className="flex items-center gap-2">
            <Badge variant={alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "warning" : "info"}>
              {severityLabel[alert.severity]}
            </Badge>
            <Badge variant="outline">{alertTypeLabel[alert.type]}</Badge>
            <Badge variant="muted">编号 {alert.id}</Badge>
          </div>
          <DrawerTitle className="mt-1">{alert.title}</DrawerTitle>
          <DrawerDescription>
            生成时间 {formatDate(alert.createdAt)} · 当前状态：{statusLabel[alert.status]}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-5 py-5">
          <Section title="触发原因">{alert.description}</Section>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="涉及客户" value={alert.customerName ?? "—"} />
            <Field label="客户经理" value={alert.managerName ?? "—"} />
            <Field
              label="涉及金额"
              value={alert.amount ? formatCurrency(alert.amount, { compact: true }) : "—"}
            />
            <Field
              label="到期日"
              value={alert.dueDate ? `${formatDate(alert.dueDate)} · ${relativeDays(alert.dueDate)}` : "—"}
            />
          </div>

          <Separator />

          <Section title="AI 建议下一步">
            <div className="flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>{alert.suggestedAction}</span>
            </div>
          </Section>

          {script ? (
            <Section title="AI 沟通话术">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm leading-6 whitespace-pre-wrap">
                {script}
              </div>
            </Section>
          ) : null}

          {pushRecords.length > 0 && (
            <Section title="企业微信推送记录">
              <div className="space-y-2">
                {pushRecords.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs rounded-md border border-border bg-card px-3 py-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-muted-foreground">{new Date(r.pushedAt).toLocaleTimeString("zh-CN")}</span>
                    <span>已推送至：{r.recipients.join("、")}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">成功</Badge>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="数据来源">
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>· 核心存贷款系统 / 2026-05 当月快照</li>
              <li>· 反洗钱监测平台 / 实时</li>
              <li>· 网格管理系统 / 周度更新</li>
            </ul>
          </Section>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="outline" size="sm" onClick={generateScript}>
            <MessageCircle className="h-3.5 w-3.5" />
            生成联系话术
          </Button>
          <Button variant="outline" size="sm" onClick={pushToWechat} disabled={pushing}>
            <Send className="h-3.5 w-3.5" />
            {pushing ? "推送中…" : "推送企业微信"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("已指派给 " + (alert.managerName ?? "本网格客户经理"))}>
            <UserPlus2 className="h-3.5 w-3.5" />
            指派经理
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => updateStatus("processing")}>
            标记处理中
          </Button>
          <Button size="sm" onClick={() => updateStatus("done")}>
            标记已完成
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</div>
      <div className="text-sm leading-6 text-foreground">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  )
}

function scriptFor(alert: BusinessAlert) {
  switch (alert.type) {
    case "deposit_due":
      return `${alert.customerName} 您好，我是丰年银行 ${alert.managerName ?? "客户经理"}。\n\n您名下一笔 ${formatCurrency(alert.amount ?? 0, { compact: true })} 的定期存款将于 ${alert.dueDate ? formatDate(alert.dueDate) : "近期"} 到期，我们为您匹配了 3 款利率更优的接续方案。\n\n方便您在工作日下午 3 点前我们沟通 10 分钟吗？`
    case "loan_due":
      return `${alert.customerName} 您好，您的贷款合同将在 ${alert.dueDate ? formatDate(alert.dueDate) : "近期"} 到期。\n\n我们已经为您预审了续作额度，整体利率较上一笔下调约 20BP，可以为您节省 ${formatCurrency((alert.amount ?? 0) * 0.002)} 的利息支出。\n\n请问您方便明天上午到网点办理吗？`
    case "financing_surge":
      return `${alert.customerName} 您好，注意到您本月融资金额新增较多，按照我们风控流程需要做一次资金用途的简要确认。\n\n如您方便，可以微信反馈用款场景或合同复印件，我们会在 1 个工作日内完成核验，避免影响后续授信。`
    default:
      return `${alert.customerName ?? "您"} 您好，根据系统监测到的 ${alertTypeLabel[alert.type]} 信号，我们想与您约一次 10 分钟左右的沟通，了解您近期的金融服务需求。`
  }
}
