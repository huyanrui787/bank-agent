// 企业微信推送 Mock 数据
export type WechatPushRecord = {
  id: string
  alertId: string
  alertTitle: string
  customerName?: string
  managerName?: string
  suggestedAction: string
  pushedAt: string
  recipients: string[]
  status: "success" | "failed"
}

const pushHistory: WechatPushRecord[] = []

export function mockPushToWechat(params: {
  alertId: string
  alertTitle: string
  customerName?: string
  managerName?: string
  suggestedAction: string
}): WechatPushRecord {
  const record: WechatPushRecord = {
    id: `WX-${Date.now()}`,
    alertId: params.alertId,
    alertTitle: params.alertTitle,
    customerName: params.customerName,
    managerName: params.managerName,
    suggestedAction: params.suggestedAction,
    pushedAt: new Date().toISOString(),
    recipients: [params.managerName ?? "本网格客户经理", "支行行长"],
    status: "success",
  }
  pushHistory.push(record)
  return record
}

export function getPushHistory(alertId: string): WechatPushRecord[] {
  return pushHistory.filter((r) => r.alertId === alertId)
}
