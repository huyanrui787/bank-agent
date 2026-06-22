import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** UUID for client-side IDs; works on HTTP (non-secure context) where crypto.randomUUID is unavailable */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function formatCurrency(value: number, opts?: { compact?: boolean }) {
  if (opts?.compact) {
    if (Math.abs(value) >= 100_000_000) return `¥${(value / 100_000_000).toFixed(2)}亿`
    if (Math.abs(value) >= 10_000) return `¥${(value / 10_000).toFixed(1)}万`
    return `¥${value.toLocaleString("zh-CN")}`
  }
  return value.toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  })
}

export function formatNumber(value: number) {
  return value.toLocaleString("zh-CN")
}

export function formatDate(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export function relativeDays(date: string | Date) {
  const target = typeof date === "string" ? new Date(date) : date
  const diff = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return "今天"
  if (diff > 0) return `${diff} 天后`
  return `${Math.abs(diff)} 天前`
}
