import type { BusinessAlert, BusinessAlertType, AlertSeverity, AlertStatus } from "./types"

const types: BusinessAlertType[] = [
  "deposit_due",
  "loan_due",
  "financing_growth",
  "financing_surge",
  "new_property",
  "grid_change",
  "branch_abnormal",
]

const sevByType: Record<BusinessAlertType, AlertSeverity> = {
  deposit_due: "warning",
  loan_due: "critical",
  financing_growth: "info",
  financing_surge: "critical",
  new_property: "info",
  grid_change: "warning",
  branch_abnormal: "critical",
}

const titleByType: Record<BusinessAlertType, string> = {
  deposit_due: "存款即将到期",
  loan_due: "贷款即将到期",
  financing_growth: "融资家数持续增长",
  financing_surge: "融资金额大幅上浮",
  new_property: "辖区新增楼盘",
  grid_change: "网格客户结构变动",
  branch_abnormal: "支行存贷数据异常",
}

const actionByType: Record<BusinessAlertType, string> = {
  deposit_due: "提前半个月电话沟通续存意向，准备产品方案",
  loan_due: "立即对接客户经理，在到期前 15 天完成续作或回收",
  financing_growth: "结合客户行业判断信贷需求，预约面谈，评估授信空间",
  financing_surge: "排查资金来源与用途，启动反洗钱核验，必要时上报合规",
  new_property: "组织上门走访，铺设按揭与对公服务，联系开发商建立合作",
  grid_change: "联动网格员核实变动情况，调整名单分配，更新客户档案",
  branch_abnormal: "支行行长牵头复盘异常波动，48小时内提交说明至总行",
}

function daysFromNow(d: number) {
  const now = new Date("2026-05-22")
  now.setDate(now.getDate() + d)
  return now.toISOString().slice(0, 10)
}

// 存贷到期客户样本（含更多客户）
const dueSample = [
  { c: "张明", m: "李雪", amt: 580_000 },
  { c: "王华", m: "李雪", amt: 1_200_000 },
  { c: "李强", m: "王晓东", amt: 320_000 },
  { c: "赵丽", m: "赵敏", amt: 980_000 },
  { c: "陈敏", m: "陈伟", amt: 150_000 },
  { c: "刘静", m: "刘洋", amt: 460_000 },
  { c: "杨杰", m: "孙静", amt: 720_000 },
  { c: "黄勇", m: "周建华", amt: 200_000 },
  { c: "周芳", m: "吴磊", amt: 1_500_000 },
  { c: "吴娟", m: "李雪", amt: 88_000 },
  { c: "林晓", m: "高雪松", amt: 340_000 },
  { c: "郭磊", m: "马涛", amt: 620_000 },
]

// 融资类客户样本
const financingSample = [
  { c: "张明", m: "李雪", amt: 480_000, families: 4, surgeAmt: 380_000 },
  { c: "王晓东", m: "王晓东", amt: 920_000, families: 6, surgeAmt: 520_000 },
  { c: "赵强", m: "赵敏", amt: 1_200_000, families: 3, surgeAmt: 680_000 },
  { c: "陈建国", m: "陈伟", amt: 350_000, families: 5, surgeAmt: 310_000 },
  { c: "刘嘉怡", m: "刘洋", amt: 760_000, families: 7, surgeAmt: 450_000 },
  { c: "孙磊", m: "孙静", amt: 580_000, families: 4, surgeAmt: 390_000 },
  { c: "周涛", m: "周建华", amt: 430_000, families: 3, surgeAmt: 320_000 },
  { c: "吴亮", m: "吴磊", amt: 890_000, families: 8, surgeAmt: 560_000 },
]

// 网格/楼盘/支行样本
const gridSample = [
  { grid: "高新一网格", manager: "李雪", enterprises: 6, residents: 240, households: 38 },
  { grid: "高新二网格", manager: "王晓东", enterprises: 3, residents: 180, households: 22 },
  { grid: "经开网格", manager: "赵敏", enterprises: 8, residents: 320, households: 45 },
  { grid: "雁塔网格", manager: "陈伟", enterprises: 4, residents: 150, households: 18 },
  { grid: "未央网格", manager: "刘洋", enterprises: 5, residents: 210, households: 30 },
]

const propertySample = [
  { name: "锦园三期", grid: "高新一网格", manager: "李雪", units: 312 },
  { name: "瑞华苑二期", grid: "高新二网格", manager: "王晓东", units: 248 },
  { name: "上林苑四期", grid: "经开网格", manager: "赵敏", units: 186 },
  { name: "凤城新城", grid: "未央网格", manager: "刘洋", units: 420 },
  { name: "翠华南苑三期", grid: "曲江网格", manager: "孙静", units: 156 },
]

const branchSample = [
  { branch: "高新支行", depositChange: -6.2, loanChange: -4.1, manager: "李雪" },
  { branch: "经开支行", depositChange: 12.8, loanChange: 15.3, manager: "赵敏" },
  { branch: "雁塔支行", depositChange: -8.5, loanChange: -3.2, manager: "陈伟" },
  { branch: "未央支行", depositChange: 9.4, loanChange: -6.7, manager: "刘洋" },
  { branch: "曲江支行", depositChange: -5.8, loanChange: 11.2, manager: "孙静" },
]

const statusList: AlertStatus[] = ["pending", "pending", "processing", "pending", "done"]

let _n = 1
function nextId() { return `A${String(_n++).padStart(3, "0")}` }

const list: BusinessAlert[] = []

// 存款到期（7条，覆盖不同到期时间）
for (let i = 0; i < 7; i++) {
  const s = dueSample[i % dueSample.length]
  list.push({
    id: nextId(), type: "deposit_due", severity: "warning",
    title: "存款即将到期",
    customerName: s.c, managerName: s.m, amount: s.amt,
    dueDate: daysFromNow(1 + i * 2),
    description: "客户 " + s.c + " 名下定期存款将于 " + daysFromNow(1 + i * 2) + " 到期，金额约 " + s.amt.toLocaleString() + " 元。请提前半个月联系客户，做好续存对接工作。",
    suggestedAction: actionByType["deposit_due"],
    createdAt: daysFromNow(-3), status: statusList[i % statusList.length],
  })
}

// 贷款到期（7条）
for (let i = 0; i < 7; i++) {
  const s = dueSample[(i + 3) % dueSample.length]
  list.push({
    id: nextId(), type: "loan_due", severity: "critical",
    title: "贷款即将到期",
    customerName: s.c, managerName: s.m, amount: s.amt,
    dueDate: daysFromNow(2 + i * 2),
    description: "客户 " + s.c + " 的贷款合同将于 " + daysFromNow(2 + i * 2) + " 到期，需要提前安排续作或回收。请在到期前 15 天完成客户对接。",
    suggestedAction: actionByType["loan_due"],
    createdAt: daysFromNow(-2), status: statusList[(i + 1) % statusList.length],
  })
}

// 融资家数增长（5条）
for (let i = 0; i < 5; i++) {
  const s = financingSample[i % financingSample.length]
  list.push({
    id: nextId(), type: "financing_growth", severity: "info",
    title: "融资家数持续增长",
    customerName: s.c, managerName: s.m, amount: s.amt,
    description: "本月辖内融资家数新增 " + s.families + " 家，客户 " + s.c + " 融资余额较前期增长 " + (15 + i * 3) + "%，建议跟进信贷需求，评估授信空间。",
    suggestedAction: actionByType["financing_growth"],
    createdAt: daysFromNow(-(i + 1)), status: statusList[i % statusList.length],
  })
}

// 融资金额大幅上浮（6条，金额均超30万）
for (let i = 0; i < 6; i++) {
  const s = financingSample[(i + 2) % financingSample.length]
  list.push({
    id: nextId(), type: "financing_surge", severity: "critical",
    title: "融资金额大幅上浮",
    customerName: s.c, managerName: s.m, amount: s.surgeAmt,
    description: "客户 " + s.c + " 融资金额单月新增 " + s.surgeAmt.toLocaleString() + " 元，超过 30 万预警阈值。本月辖内融资金额大幅上浮客户共 " + (s.families - 1) + " 家，请排查资金来源与用途。",
    suggestedAction: actionByType["financing_surge"],
    createdAt: daysFromNow(-(i + 2)), status: statusList[(i + 2) % statusList.length],
  })
}

// 新增楼盘（5条，覆盖不同网格）
for (let i = 0; i < 5; i++) {
  const p = propertySample[i % propertySample.length]
  list.push({
    id: nextId(), type: "new_property", severity: "info",
    title: "辖区新增楼盘",
    managerName: p.manager,
    description: "辖区「" + p.name + "」（" + p.grid + "）新增楼盘，预计交付 " + p.units + " 户，建议组织上门走访，铺设按揭与代发业务。",
    suggestedAction: actionByType["new_property"],
    createdAt: daysFromNow(-(i + 1)), status: statusList[i % statusList.length],
  })
}

// 网格变动（5条，覆盖不同网格）
for (let i = 0; i < 5; i++) {
  const g = gridSample[i % gridSample.length]
  list.push({
    id: nextId(), type: "grid_change", severity: "warning",
    title: "网格客户结构变动",
    managerName: g.manager,
    description: g.grid + " 新增企业 " + g.enterprises + " 家、村居人口流入 " + g.residents + " 人、小区新入住 " + g.households + " 户，建议联动网格员核实，重新分配名单。",
    suggestedAction: actionByType["grid_change"],
    createdAt: daysFromNow(-(i + 3)), status: statusList[(i + 1) % statusList.length],
  })
}

// 支行异常（5条，覆盖不同支行，总行层级）
for (let i = 0; i < 5; i++) {
  const b = branchSample[i % branchSample.length]
  const depSign = b.depositChange >= 0 ? "上升" : "下降"
  const loanSign = b.loanChange >= 0 ? "上升" : "下降"
  list.push({
    id: nextId(), type: "branch_abnormal", severity: "critical",
    title: b.branch + " 存贷数据异常",
    description: "【总行层级预警】" + b.branch + " 本月存款较上月" + depSign + " " + Math.abs(b.depositChange) + "%（阈值正负5%），贷款余额" + loanSign + " " + Math.abs(b.loanChange) + "%，属非正常波动，需支行行长牵头复盘并提交说明。",
    suggestedAction: actionByType["branch_abnormal"],
    createdAt: daysFromNow(-(i + 1)), status: statusList[(i + 2) % statusList.length],
  })
}

export const alerts: BusinessAlert[] = list

export const alertTypeLabel: Record<BusinessAlertType, string> = {
  deposit_due: "存款到期",
  loan_due: "贷款到期",
  financing_growth: "融资家数增长",
  financing_surge: "融资大幅上浮",
  new_property: "新增楼盘",
  grid_change: "网格变动",
  branch_abnormal: "支行异常",
}

export const severityLabel: Record<AlertSeverity, string> = {
  info: "提示",
  warning: "关注",
  critical: "紧急",
}

export const statusLabel: Record<AlertStatus, string> = {
  pending: "待处理",
  processing: "处理中",
  done: "已完成",
}
