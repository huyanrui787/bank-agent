"use client"

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@/lib/utils"
import type { CashflowAnalysis } from "@/lib/mock/types"

export function CashflowChart({ data }: { data: CashflowAnalysis["monthlyTrend"] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`}
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(value, key) =>
            `${formatCurrency(Number(value), { compact: true })} (${key === "inflow" ? "入账" : "出账"})`
          }
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            fontSize: 12,
            boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
          }}
        />
        <Line
          type="monotone"
          dataKey="inflow"
          stroke="#1e40af"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="outflow"
          stroke="#dc2626"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
