"use client"

import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { ChevronDown, ChevronUp, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn, formatCurrency } from "@/lib/utils"
import type { Customer } from "@/lib/mock/types"

const riskVariantMap: Record<string, "success" | "warning" | "critical"> = {
  low: "success",
  medium: "warning",
  high: "critical",
}
const riskLabel: Record<string, string> = { low: "低风险", medium: "中风险", high: "高风险" }

const segmentLabel: Record<Customer["segment"], string> = {
  high_net_worth: "高净值",
  stock: "存量",
  potential: "潜在",
  new: "新户",
}

const columns: ColumnDef<Customer>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "id",
    header: "编号",
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.id}</span>,
  },
  {
    accessorKey: "name",
    header: "客户姓名",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.idNoMasked}</span>
      </div>
    ),
  },
  {
    accessorKey: "phoneMasked",
    header: "联系方式",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.phoneMasked}</span>,
  },
  {
    accessorKey: "community",
    header: "网格 / 小区",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.community}</span>
        <span className="text-xs text-muted-foreground">{row.original.grid}</span>
      </div>
    ),
  },
  {
    accessorKey: "managerName",
    header: "客户经理",
    filterFn: (row, _, value) => (value === "all" ? true : row.original.managerName === value),
  },
  {
    accessorKey: "avgDeposit",
    header: "日均存款",
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.avgDeposit, { compact: true })}</span>
    ),
  },
  {
    accessorKey: "mortgageLoan",
    header: "抵押 / 信用",
    cell: ({ row }) => (
      <div className="flex flex-col text-xs">
        <span>抵 {formatCurrency(row.original.mortgageLoan, { compact: true })}</span>
        <span className="text-muted-foreground">信 {formatCurrency(row.original.creditLoan, { compact: true })}</span>
      </div>
    ),
  },
  {
    id: "segment",
    accessorKey: "segment",
    header: "客群",
    cell: ({ row }) => (
      <Badge variant="muted">{segmentLabel[row.original.segment]}</Badge>
    ),
  },
  {
    id: "riskLevel",
    accessorKey: "riskLevel",
    header: "风险",
    cell: ({ row }) => (
      <Badge variant={riskVariantMap[row.original.riskLevel]}>
        {riskLabel[row.original.riskLevel]}
      </Badge>
    ),
    filterFn: (row, _, value) => (value === "all" ? true : row.original.riskLevel === value),
  },
]

export function CustomerTable({
  data,
  managerOptions,
  toolbarRight,
}: {
  data: Customer[]
  managerOptions?: string[]
  toolbarRight?: React.ReactNode
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table 与 React Compiler 已知不兼容，编译器会自动跳过本组件
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
    globalFilterFn: (row, _, value) => {
      const v = String(value).trim()
      if (!v) return true
      const c = row.original
      return [c.name, c.idNoMasked, c.phoneMasked, c.community, c.address, c.managerName]
        .some((field) => field?.includes(v))
    },
  })

  const managers = useMemo(
    () => managerOptions ?? Array.from(new Set(data.map((c) => c.managerName))),
    [data, managerOptions]
  )

  const selectedCount = table.getSelectedRowModel().rows.length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="搜索姓名 / 身份证 / 手机 / 地址"
            className="pl-8 w-72"
          />
        </div>
        <Select
          value={(table.getColumn("riskLevel")?.getFilterValue() as string) ?? "all"}
          onValueChange={(v) => table.getColumn("riskLevel")?.setFilterValue(v)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="风险等级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部风险</SelectItem>
            <SelectItem value="low">低风险</SelectItem>
            <SelectItem value="medium">中风险</SelectItem>
            <SelectItem value="high">高风险</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={(table.getColumn("managerName")?.getFilterValue() as string) ?? "all"}
          onValueChange={(v) => table.getColumn("managerName")?.setFilterValue(v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="客户经理" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部经理</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {selectedCount > 0 ? (
            <span className="text-xs text-muted-foreground">已选 {selectedCount} 位</span>
          ) : null}
          {toolbarRight}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort()
                  const sort = h.column.getIsSorted()
                  return (
                    <TableHead
                      key={h.id}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      className={cn(canSort && "cursor-pointer select-none")}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {sort === "asc" ? <ChevronUp className="h-3 w-3" /> : null}
                        {sort === "desc" ? <ChevronDown className="h-3 w-3" /> : null}
                      </span>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-sm text-muted-foreground py-10">
                  暂无符合条件的客户
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>共 {table.getFilteredRowModel().rows.length} 位客户</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            上一页
          </Button>
          <span>
            第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}
