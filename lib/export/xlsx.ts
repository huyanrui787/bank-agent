/**
 * 把行数据转换为 .xlsx Buffer，用于 /api/export?format=xlsx。
 * 与 csv.ts 共用 columns 定义，保证两种格式字段一致。
 */
import ExcelJS from "exceljs"

export type XlsxColumn = {
  key: string
  label: string
  /** Excel number format 字符串，例如 '#,##0' 用于金额 */
  numFmt?: string
  /** 列宽（字符数） */
  width?: number
}

export async function toXlsx(
  rows: Record<string, unknown>[],
  columns: XlsxColumn[],
  opts?: { sheetName?: string; title?: string }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "AI 客户经营助手 Demo"
  wb.created = new Date()

  const ws = wb.addWorksheet(opts?.sheetName ?? "Sheet1", {
    views: [{ state: "frozen", ySplit: opts?.title ? 2 : 1 }],
  })

  if (opts?.title) {
    const headerRow = ws.addRow([opts.title])
    ws.mergeCells(1, 1, 1, columns.length)
    headerRow.font = { size: 14, bold: true, color: { argb: "FF1E40AF" } }
    headerRow.alignment = { vertical: "middle", horizontal: "left" }
    headerRow.height = 22
  }

  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.width ?? Math.max(12, c.label.length * 2 + 4),
    style: c.numFmt ? { numFmt: c.numFmt } : undefined,
  }))

  // 表头样式
  const headerRowIndex = opts?.title ? 2 : 1
  const headerRow = ws.getRow(headerRowIndex)
  headerRow.values = columns.map((c) => c.label)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } }
    cell.alignment = { vertical: "middle", horizontal: "left" }
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    }
  })
  headerRow.height = 22

  for (const row of rows) {
    const data: Record<string, unknown> = {}
    for (const c of columns) {
      const v = row[c.key]
      data[c.key] = typeof v === "boolean" ? (v ? "是" : "否") : v ?? ""
    }
    ws.addRow(data)
  }

  // 斑马纹
  for (let i = headerRowIndex + 1; i <= ws.rowCount; i++) {
    if ((i - headerRowIndex) % 2 === 0) {
      ws.getRow(i).eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      })
    }
  }

  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columns.length },
  }

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  return Buffer.from(buf)
}

export const customerXlsxColumns: XlsxColumn[] = [
  { key: "id", label: "客户编号", width: 10 },
  { key: "name", label: "客户姓名", width: 12 },
  { key: "idNoMasked", label: "身份证号(脱敏)", width: 22 },
  { key: "phoneMasked", label: "联系电话", width: 16 },
  { key: "community", label: "小区", width: 18 },
  { key: "grid", label: "网格", width: 14 },
  { key: "branch", label: "支行", width: 14 },
  { key: "managerName", label: "客户经理", width: 12 },
  { key: "avgDeposit", label: "日均存款(元)", width: 16, numFmt: "#,##0" },
  { key: "mortgageLoan", label: "抵押贷款余额(元)", width: 18, numFmt: "#,##0" },
  { key: "creditLoan", label: "信用贷款余额(元)", width: 18, numFmt: "#,##0" },
  { key: "hasValidContract", label: "有效合同", width: 10 },
  { key: "usedCreditAmount", label: "当前用信(元)", width: 16, numFmt: "#,##0" },
  { key: "hasOtherBankLoan", label: "他行有贷", width: 10 },
  { key: "riskLevel", label: "风险等级", width: 10 },
]

export const managerXlsxColumns: XlsxColumn[] = [
  { key: "id", label: "经理编号", width: 10 },
  { key: "name", label: "客户经理", width: 12 },
  { key: "branch", label: "支行", width: 14 },
  { key: "grid", label: "网格", width: 14 },
  { key: "currentCustomerCount", label: "当前管户数", width: 12 },
  { key: "monthlyDepositIncrease", label: "本月新增存款(元)", width: 18, numFmt: "#,##0" },
  { key: "monthlyLoanIncrease", label: "本月新增贷款(元)", width: 18, numFmt: "#,##0" },
  { key: "monthlyNewCustomers", label: "本月新增客户", width: 14 },
  { key: "maintenanceScore", label: "维护得分", width: 10 },
  { key: "vsLastMonthDeposit", label: "存款环比%", width: 12, numFmt: "0.0" },
  { key: "vsLastMonthLoan", label: "贷款环比%", width: 12, numFmt: "0.0" },
]

export const alertXlsxColumns: XlsxColumn[] = [
  { key: "id", label: "预警编号", width: 10 },
  { key: "type", label: "类型", width: 18 },
  { key: "severity", label: "等级", width: 10 },
  { key: "title", label: "标题", width: 22 },
  { key: "customerName", label: "客户", width: 12 },
  { key: "managerName", label: "客户经理", width: 12 },
  { key: "amount", label: "涉及金额(元)", width: 16, numFmt: "#,##0" },
  { key: "dueDate", label: "到期日", width: 14 },
  { key: "status", label: "状态", width: 10 },
  { key: "createdAt", label: "生成时间", width: 14 },
  { key: "description", label: "说明", width: 40 },
  { key: "suggestedAction", label: "建议动作", width: 40 },
]

export const xlsxFor = {
  customers: {
    columns: customerXlsxColumns,
    sheetName: "客户清单",
    title: "AI 客户经营助手 · 客户清单",
  },
  managers: {
    columns: managerXlsxColumns,
    sheetName: "客户经理绩效",
    title: "AI 客户经营助手 · 客户经理绩效",
  },
  alerts: {
    columns: alertXlsxColumns,
    sheetName: "业务预警",
    title: "AI 客户经营助手 · 业务预警清单",
  },
} as const
