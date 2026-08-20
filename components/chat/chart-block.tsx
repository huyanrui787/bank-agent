"use client"

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Treemap,
} from "recharts"
import type { ChartSpec } from "@/lib/agent/tools"

const DEFAULT_COLORS = ["#1e40af", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#0891b2"]

type ChartBlockData = {
  charts: ChartSpec[]
  stdout?: string
  task?: string
}

export function ChartBlock({ data }: { data: ChartBlockData }) {
  const { charts, stdout } = data
  if (!charts?.length) {
    return stdout ? (
      <pre className="text-xs bg-muted/50 rounded-md p-3 whitespace-pre-wrap">{stdout}</pre>
    ) : null
  }

  return (
    <div className="space-y-6">
      {charts.map((chart, i) => (
        <SingleChart key={i} chart={chart} />
      ))}
      {stdout && (
        <pre className="text-xs bg-muted/40 rounded-md p-3 whitespace-pre-wrap text-muted-foreground">
          {stdout}
        </pre>
      )}
    </div>
  )
}

function SingleChart({ chart }: { chart: ChartSpec }) {
  const { type, title, data, xKey, yKeys } = chart

  if (type === "pie") {
    return (
      <div>
        <div className="text-sm font-medium mb-3">{title}</div>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey={yKeys[0]?.key ?? "value"}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={yKeys[idx]?.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [v, yKeys[0]?.label ?? ""]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === "line") {
    return (
      <div>
        <div className="text-sm font-medium mb-3">{title}</div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={50} />
            <Tooltip />
            <Legend />
            {yKeys.map((yk, idx) => (
              <Line
                key={yk.key}
                type="monotone"
                dataKey={yk.key}
                name={yk.label}
                stroke={yk.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (type === "treemap") {
    return (
      <div>
        <div className="text-sm font-medium mb-3">{title}</div>
        <ResponsiveContainer width="100%" height={260}>
          <Treemap data={data} dataKey={yKeys[0]?.key ?? "value"} nameKey={xKey} stroke="#fff">
            <Tooltip formatter={(v) => [v, yKeys[0]?.label ?? ""]} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    )
  }

  // default: bar
  return (
    <div>
      <div className="text-sm font-medium mb-3">{title}</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={50} />
          <Tooltip />
          {yKeys.length > 1 && <Legend />}
          {yKeys.map((yk, idx) => (
            <Bar
              key={yk.key}
              dataKey={yk.key}
              name={yk.label}
              fill={yk.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
