"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { managers } from "@/lib/mock/managers"
import { formatCurrency } from "@/lib/utils"

export function ManagerRanking() {
  const data = [...managers]
    .sort((a, b) => b.monthlyDepositIncrease - a.monthlyDepositIncrease)
    .map((m) => ({
      name: m.name,
      deposit: m.monthlyDepositIncrease / 10000,
      loan: m.monthlyLoanIncrease / 10000,
    }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap={18}>
        <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `${v}万`}
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value, key) =>
            `${formatCurrency(Number(value) * 10000, { compact: true })} (${key === "deposit" ? "新增存款" : "新增贷款"})`
          }
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 12,
            boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
          }}
        />
        <Bar dataKey="deposit" fill="#1e40af" radius={[4, 4, 0, 0]} />
        <Bar dataKey="loan" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
