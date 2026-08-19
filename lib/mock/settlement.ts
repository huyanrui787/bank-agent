// 「对公结算流水库」演示数据（写入 data/settlement.db）。全部为虚构数据。

export type SettlementFlow = {
  id: string
  companyId: string
  flowDate: string
  direction: "in" | "out"
  amount: number
  counterparty: string
  channel: string
}

const COUNTERPARTIES = [
  "陕西恒达贸易有限公司", "西部新能源科技有限公司", "西安华宇精密制造有限公司",
  "京东工业品", "陕西机电进出口有限公司", "西安高新区电力公司", "陕西宏远机械制造有限公司",
]

export const settlementFlows: SettlementFlow[] = (() => {
  const flows: SettlementFlow[] = []
  let n = 1
  for (let i = 0; i < 36; i++) {
    const cid = `E${String(i + 1).padStart(3, "0")}`
    for (let j = 0; j < 1 + (i % 2); j++) {
      flows.push({
        id: `SF${String(n).padStart(3, "0")}`,
        companyId: cid,
        flowDate: `2026-0${1 + (i % 6)}-${String(1 + ((i + j) % 27)).padStart(2, "0")}`,
        direction: (i + j) % 2 === 0 ? "in" : "out",
        amount: (10 + ((i * 47 + j * 31) % 500)) * 10000,
        counterparty: COUNTERPARTIES[(i + j) % COUNTERPARTIES.length],
        channel: ["转账", "票据", "现金"][(i + j) % 3],
      })
      n++
    }
  }
  return flows
})()
