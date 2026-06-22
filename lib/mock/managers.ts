import type { Manager } from "./types"

// 生成某经理某月的数据（基于 seed 确定性生成）
function monthData(seed: number, base: { deposit: number; loan: number; customers: number }) {
  const r = (s: number) => Math.abs(Math.sin(s) * 100) % 1
  const pct = (s: number) => parseFloat(((r(s) * 30) - 10).toFixed(1)) // -10% ~ +20%
  return {
    depositIncrease: Math.round(base.deposit * (0.8 + r(seed) * 0.5)),
    loanIncrease: Math.round(base.loan * (0.75 + r(seed + 1) * 0.6)),
    newCustomers: Math.max(1, Math.round(base.customers * (0.7 + r(seed + 2) * 0.7))),
    vsLastMonthDeposit: pct(seed + 3),
    vsLastMonthLoan: pct(seed + 4),
  }
}

const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]

function buildMonthlyData(id: number, base: { deposit: number; loan: number; customers: number }) {
  const result: Manager["monthlyData"] = {}
  MONTHS.forEach((m, i) => {
    result[m] = monthData(id * 100 + i * 7, base)
  })
  return result
}

export const managers: Manager[] = [
  {
    id: "M001", name: "李雪", branch: "高新支行", grid: "高新一网格",
    currentCustomerCount: 286, monthlyDepositIncrease: 4_820_000, monthlyLoanIncrease: 2_100_000,
    monthlyNewCustomers: 18, maintenanceScore: 92, vsLastMonthDeposit: 12.4, vsLastMonthLoan: 6.8,
    monthlyData: buildMonthlyData(1, { deposit: 4_820_000, loan: 2_100_000, customers: 18 }),
  },
  {
    id: "M002", name: "王晓东", branch: "高新支行", grid: "高新二网格",
    currentCustomerCount: 254, monthlyDepositIncrease: 3_950_000, monthlyLoanIncrease: 1_750_000,
    monthlyNewCustomers: 14, maintenanceScore: 88, vsLastMonthDeposit: 9.1, vsLastMonthLoan: -3.2,
    monthlyData: buildMonthlyData(2, { deposit: 3_950_000, loan: 1_750_000, customers: 14 }),
  },
  {
    id: "M003", name: "赵敏", branch: "经开支行", grid: "经开网格",
    currentCustomerCount: 312, monthlyDepositIncrease: 6_120_000, monthlyLoanIncrease: 3_400_000,
    monthlyNewCustomers: 22, maintenanceScore: 95, vsLastMonthDeposit: 18.7, vsLastMonthLoan: 11.4,
    monthlyData: buildMonthlyData(3, { deposit: 6_120_000, loan: 3_400_000, customers: 22 }),
  },
  {
    id: "M004", name: "陈伟", branch: "雁塔支行", grid: "雁塔网格",
    currentCustomerCount: 198, monthlyDepositIncrease: 2_780_000, monthlyLoanIncrease: 980_000,
    monthlyNewCustomers: 9, maintenanceScore: 81, vsLastMonthDeposit: 4.2, vsLastMonthLoan: -1.8,
    monthlyData: buildMonthlyData(4, { deposit: 2_780_000, loan: 980_000, customers: 9 }),
  },
  {
    id: "M005", name: "刘洋", branch: "未央支行", grid: "未央网格",
    currentCustomerCount: 232, monthlyDepositIncrease: 3_410_000, monthlyLoanIncrease: 1_280_000,
    monthlyNewCustomers: 12, maintenanceScore: 84, vsLastMonthDeposit: 7.6, vsLastMonthLoan: 2.1,
    monthlyData: buildMonthlyData(5, { deposit: 3_410_000, loan: 1_280_000, customers: 12 }),
  },
  {
    id: "M006", name: "孙静", branch: "曲江支行", grid: "曲江网格",
    currentCustomerCount: 267, monthlyDepositIncrease: 4_240_000, monthlyLoanIncrease: 1_910_000,
    monthlyNewCustomers: 16, maintenanceScore: 89, vsLastMonthDeposit: 11.2, vsLastMonthLoan: 5.4,
    monthlyData: buildMonthlyData(6, { deposit: 4_240_000, loan: 1_910_000, customers: 16 }),
  },
  {
    id: "M007", name: "周建华", branch: "高新支行", grid: "高新二网格",
    currentCustomerCount: 178, monthlyDepositIncrease: 2_100_000, monthlyLoanIncrease: 720_000,
    monthlyNewCustomers: 7, maintenanceScore: 76, vsLastMonthDeposit: -2.8, vsLastMonthLoan: -4.1,
    monthlyData: buildMonthlyData(7, { deposit: 2_100_000, loan: 720_000, customers: 7 }),
  },
  {
    id: "M008", name: "吴磊", branch: "经开支行", grid: "经开网格",
    currentCustomerCount: 244, monthlyDepositIncrease: 3_680_000, monthlyLoanIncrease: 1_540_000,
    monthlyNewCustomers: 13, maintenanceScore: 85, vsLastMonthDeposit: 8.4, vsLastMonthLoan: 3.6,
    monthlyData: buildMonthlyData(8, { deposit: 3_680_000, loan: 1_540_000, customers: 13 }),
  },
  {
    id: "M009", name: "张磊", branch: "灞桥支行", grid: "灞桥网格",
    currentCustomerCount: 221, monthlyDepositIncrease: 3_120_000, monthlyLoanIncrease: 1_380_000,
    monthlyNewCustomers: 11, maintenanceScore: 83, vsLastMonthDeposit: 6.3, vsLastMonthLoan: 1.9,
    monthlyData: buildMonthlyData(9, { deposit: 3_120_000, loan: 1_380_000, customers: 11 }),
  },
  {
    id: "M010", name: "林晓华", branch: "莲湖支行", grid: "莲湖网格",
    currentCustomerCount: 195, monthlyDepositIncrease: 2_560_000, monthlyLoanIncrease: 1_050_000,
    monthlyNewCustomers: 8, maintenanceScore: 79, vsLastMonthDeposit: 3.1, vsLastMonthLoan: -0.8,
    monthlyData: buildMonthlyData(10, { deposit: 2_560_000, loan: 1_050_000, customers: 8 }),
  },
  {
    id: "M011", name: "郭建国", branch: "新城支行", grid: "新城网格",
    currentCustomerCount: 308, monthlyDepositIncrease: 5_840_000, monthlyLoanIncrease: 2_760_000,
    monthlyNewCustomers: 20, maintenanceScore: 93, vsLastMonthDeposit: 15.6, vsLastMonthLoan: 9.2,
    monthlyData: buildMonthlyData(11, { deposit: 5_840_000, loan: 2_760_000, customers: 20 }),
  },
  {
    id: "M012", name: "何晓东", branch: "碑林支行", grid: "碑林网格",
    currentCustomerCount: 176, monthlyDepositIncrease: 1_980_000, monthlyLoanIncrease: 680_000,
    monthlyNewCustomers: 6, maintenanceScore: 74, vsLastMonthDeposit: -1.4, vsLastMonthLoan: -5.3,
    monthlyData: buildMonthlyData(12, { deposit: 1_980_000, loan: 680_000, customers: 6 }),
  },
  {
    id: "M013", name: "高雪松", branch: "经开支行", grid: "经开网格",
    currentCustomerCount: 259, monthlyDepositIncrease: 4_050_000, monthlyLoanIncrease: 1_820_000,
    monthlyNewCustomers: 15, maintenanceScore: 87, vsLastMonthDeposit: 10.5, vsLastMonthLoan: 4.7,
    monthlyData: buildMonthlyData(13, { deposit: 4_050_000, loan: 1_820_000, customers: 15 }),
  },
  {
    id: "M014", name: "罗嘉怡", branch: "曲江支行", grid: "曲江网格",
    currentCustomerCount: 188, monthlyDepositIncrease: 2_340_000, monthlyLoanIncrease: 890_000,
    monthlyNewCustomers: 8, maintenanceScore: 80, vsLastMonthDeposit: 2.8, vsLastMonthLoan: -2.1,
    monthlyData: buildMonthlyData(14, { deposit: 2_340_000, loan: 890_000, customers: 8 }),
  },
  {
    id: "M015", name: "马涛", branch: "未央支行", grid: "未央网格",
    currentCustomerCount: 275, monthlyDepositIncrease: 4_620_000, monthlyLoanIncrease: 2_280_000,
    monthlyNewCustomers: 17, maintenanceScore: 91, vsLastMonthDeposit: 13.8, vsLastMonthLoan: 8.1,
    monthlyData: buildMonthlyData(15, { deposit: 4_620_000, loan: 2_280_000, customers: 17 }),
  },
]
