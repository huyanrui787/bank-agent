import type { Customer, DepositTerm } from "./types"

const surnames = [
  "张", "王", "李", "赵", "陈", "刘", "杨", "黄", "周", "吴",
  "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "罗",
]
const givenNames = [
  "明", "华", "强", "伟", "丽", "敏", "静", "杰", "勇", "芳",
  "娟", "鹏", "磊", "涛", "军", "亮", "建国", "晓东", "雪松", "嘉怡",
]

const communities = [
  "高新区·锦园", "高新区·瑞华苑", "雁塔·紫薇花园", "未央·凤城三号",
  "经开区·上林苑", "曲江·翠华南苑", "灞桥·纺织花园", "莲湖·西华门小区",
  "新城·东大街26号", "碑林·南门里小区",
]

const grids = ["高新一网格", "高新二网格", "雁塔网格", "未央网格", "经开网格", "曲江网格"]
const branches = ["高新支行", "经开支行", "雁塔支行", "未央支行", "曲江支行"]
const managers = [
  "李雪", "王晓东", "赵敏", "陈伟", "刘洋", "孙静", "周建华", "吴磊",
]

const segments: Customer["segment"][] = ["high_net_worth", "stock", "potential", "new"]
const risks: Customer["riskLevel"][] = ["low", "medium", "high"]
const depositTerms: DepositTerm[] = ["活期", "3个月", "6个月", "1年", "3年"]

function isoDateInYear(seed: number) {
  // 今年内随机日期（2026-01-01 到 2026-05-22）
  const start = new Date("2026-01-01")
  const end = new Date("2026-05-22")
  const range = end.getTime() - start.getTime()
  const r = Math.abs(Math.sin(seed * 17) * 10000) % 1
  return new Date(start.getTime() + r * range).toISOString().slice(0, 10)
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function randInRange(seed: number, min: number, max: number) {
  const r = Math.abs(Math.sin(seed) * 10000) % 1
  return Math.floor(min + r * (max - min))
}

function maskedIdNo(seed: number) {
  const prefix = 610000 + (seed % 90)
  const suffix = 1000 + randInRange(seed * 2, 1, 8999)
  return `${prefix}********${suffix}`
}

function maskedPhone(seed: number) {
  const head = 130 + (seed % 60)
  const tail = 1000 + randInRange(seed * 3, 1, 8999)
  return `${head}****${tail}`
}

function isoDateBack(days: number) {
  const d = new Date("2026-05-22")
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const baseCustomers: Customer[] = []
for (let i = 1; i <= 86; i++) {
  const seed = i * 7 + 13
  const segment = pick(segments, i)
  const community = pick(communities, i)
  const grid = pick(grids, Math.floor(i / 2))
  const branch = pick(branches, Math.floor(i / 3))
  const manager = pick(managers, i)
  const name = `${pick(surnames, i)}${pick(givenNames, i * 2 + 1)}`

  const avgDeposit =
    segment === "high_net_worth"
      ? randInRange(seed, 300_000, 3_000_000)
      : segment === "stock"
        ? randInRange(seed, 80_000, 280_000)
        : segment === "potential"
          ? randInRange(seed, 30_000, 90_000)
          : randInRange(seed, 5_000, 30_000)

  const mortgageLoan =
    i % 4 === 0 ? randInRange(seed + 1, 200_000, 2_000_000) : 0
  const creditLoan =
    i % 5 === 0 ? randInRange(seed + 2, 30_000, 300_000) : 0
  const hasValidContract = i % 3 === 0
  const usedCreditAmount = hasValidContract && i % 6 === 0 ? 0 : randInRange(seed + 3, 0, 200_000)
  const hasOtherBankLoan = i % 7 === 0
  const riskLevel = pick(risks, Math.floor(seed / 11))

  baseCustomers.push({
    id: `C${String(i).padStart(3, "0")}`,
    name,
    idNoMasked: maskedIdNo(seed),
    phoneMasked: maskedPhone(seed),
    address: `${community} ${randInRange(seed + 4, 1, 30)}号楼 ${randInRange(seed + 5, 101, 2901)}`,
    community,
    grid,
    branch,
    managerName: manager,
    avgDeposit,
    mortgageLoan,
    creditLoan,
    hasValidContract,
    usedCreditAmount,
    creditReportUpdatedAt: i % 2 === 0 ? isoDateBack(randInRange(seed + 6, 10, 320)) : undefined,
    hasOtherBankLoan,
    riskLevel,
    segment,
    lastVisitAt: i % 3 === 0 ? isoDateBack(randInRange(seed + 7, 3, 120)) : undefined,
    introducedAt: isoDateInYear(seed + 8),
    depositTerm: pick(depositTerms, seed + 9),
    performanceOwner: manager,
  })
}

baseCustomers[0] = {
  ...baseCustomers[0],
  id: "C001",
  name: "张明",
  idNoMasked: "6101********1234",
  phoneMasked: "138****5678",
  address: "高新区·锦园 3号楼 1201",
  community: "高新区·锦园",
  grid: "高新一网格",
  branch: "高新支行",
  managerName: "李雪",
  avgDeposit: 285_000,
  mortgageLoan: 1_200_000,
  creditLoan: 50_000,
  hasValidContract: true,
  usedCreditAmount: 0,
  creditReportUpdatedAt: "2026-04-12",
  hasOtherBankLoan: true,
  riskLevel: "medium",
  segment: "high_net_worth",
  lastVisitAt: "2026-04-28",
  introducedAt: "2026-01-15",
  depositTerm: "3年",
  performanceOwner: "李雪",
}

export const customers: Customer[] = baseCustomers

export function findCustomer(query: string): Customer | undefined {
  const q = query.trim()
  if (!q) return undefined
  return customers.find(
    (c) =>
      c.name === q ||
      c.id === q.toUpperCase() ||
      c.idNoMasked.includes(q) ||
      c.phoneMasked.includes(q) ||
      c.community.includes(q) ||
      c.address.includes(q)
  )
}
