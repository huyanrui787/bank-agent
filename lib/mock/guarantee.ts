// 「担保关系库」演示数据（写入 data/guarantee.db）。全部为虚构数据。

export type Guarantee = {
  id: string
  companyId: string
  guarantorId: string
  type: string
  amount: number
  startDate: string
  endDate: string
  status: string
}

const GUARANTEE_TYPES = ["互保", "连带责任", "抵押担保"]
const GUARANTEE_STATUS = ["有效", "有效", "有效", "已解除", "逾期"]

export const guarantees: Guarantee[] = (() => {
  const list: Guarantee[] = []
  for (let i = 0; i < 30; i++) {
    list.push({
      id: `G${String(i + 1).padStart(3, "0")}`,
      companyId: `E${String((i % 36) + 1).padStart(3, "0")}`,
      guarantorId: `E${String(((i + 3) % 36) + 1).padStart(3, "0")}`,
      type: GUARANTEE_TYPES[i % 3],
      amount: (5 + ((i * 29) % 300)) * 10000,
      startDate: `2025-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2, "0")}`,
      endDate: `2027-0${1 + ((i + 2) % 9)}-${String(1 + (i % 27)).padStart(2, "0")}`,
      status: GUARANTEE_STATUS[i % 5],
    })
  }
  return list
})()
