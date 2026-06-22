"use client"

import { Bell, Building2, Shield, LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useUser, ROLE_LABELS } from "@/lib/hooks/use-user"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function AppHeader() {
  const { user, loading } = useUser()
  const router = useRouter()

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // ignore network errors — redirect anyway
    }
    router.push("/login")
  }

  const initial = user?.name?.[0] ?? "?"
  const displayName = user ? `${user.name}${user.branch ? " · " + user.branch : ""}` : ""
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : ""

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-card px-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>龙湾农村商业银行</span>
        </div>
        <Badge variant="muted" className="hidden md:inline-flex">
          <Shield className="h-3 w-3" />
          演示环境 · 数据已脱敏
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="h-7 w-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-medium">
            {loading ? "…" : initial}
          </div>
          {!loading && user && (
            <div className="hidden md:flex flex-col leading-tight text-xs">
              <span className="font-medium">{displayName}</span>
              <span className="text-muted-foreground">{roleLabel}</span>
            </div>
          )}
        </div>
        {!loading && user && (
          <button
            onClick={handleLogout}
            title="退出登录"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </header>
  )
}
