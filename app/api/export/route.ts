import { NextRequest } from "next/server"
import { getDb, rowToCustomer, rowToManager, rowToAlert } from "@/lib/db"
import { userFromHeaders, buildScope } from "@/lib/auth/scope"
import { can } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit/log"
import {
  alertCsvColumns,
  customerCsvColumns,
  managerCsvColumns,
  toCSV,
} from "@/lib/export/csv"
import { toXlsx, xlsxFor } from "@/lib/export/xlsx"

const BOM = "﻿"

type ExportType = "customers" | "managers" | "alerts"
type ExportFormat = "csv" | "xlsx"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!can(user.role, "export")) {
    writeAuditLog({
      actorId: user.sub,
      actorName: user.name,
      actorRole: user.role,
      actorBranch: user.branch,
      action: "access.denied",
      resourceType: "export",
      summary: `${user.name} 无导出权限（角色：${user.role}）`,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
      requestId: req.headers.get("x-request-id") ?? null,
      dataScope: null,
    })
    return new Response(JSON.stringify({ error: "当前角色无导出权限" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { searchParams } = new URL(req.url)
  const type = (searchParams.get("type") ?? "customers") as ExportType
  const format = (searchParams.get("format") ?? "csv") as ExportFormat

  const db = getDb()
  const scope = buildScope(user)

  let rows: unknown[]
  let recordCount: number

  if (type === "managers") {
    const raw = db
      .prepare(
        `SELECT * FROM (SELECT * FROM managers ORDER BY monthly_deposit_increase DESC)
         WHERE ${scope.managerWhere}`
      )
      .all(...scope.managerParams) as Record<string, unknown>[]
    rows = raw.map(rowToManager)
    recordCount = rows.length
  } else if (type === "alerts") {
    const raw = db
      .prepare(
        `SELECT * FROM (SELECT * FROM alerts ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END)
         WHERE ${scope.alertWhere}`
      )
      .all(...scope.alertParams) as Record<string, unknown>[]
    rows = raw.map(rowToAlert)
    recordCount = rows.length
  } else {
    const raw = db
      .prepare(`SELECT * FROM customers WHERE ${scope.customerWhere}`)
      .all(...scope.customerParams) as Record<string, unknown>[]
    rows = raw.map((r) => rowToCustomer(r))
    recordCount = rows.length
  }

  writeAuditLog({
    actorId: user.sub,
    actorName: user.name,
    actorRole: user.role,
    actorBranch: user.branch,
    action: `data.export.${type}`,
    resourceType: type,
    summary: `${user.name} 导出 ${type} 数据 ${recordCount} 条（${format}）`,
    detail: { type, format, recordCount },
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: scope.label,
    recordCount,
  })

  if (format === "xlsx") {
    const meta = xlsxFor[type] ?? xlsxFor.customers
    const buf = await toXlsx(rows as Record<string, unknown>[], meta.columns, {
      sheetName: meta.sheetName,
      title: meta.title,
    })
    const filename = `${type}_${stamp()}.xlsx`
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const csvCols =
    type === "managers"
      ? managerCsvColumns
      : type === "alerts"
        ? alertCsvColumns
        : customerCsvColumns
  const csv = toCSV(rows as Record<string, unknown>[], csvCols)
  const filename = `${type}_${stamp()}.csv`
  return new Response(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

function stamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}
