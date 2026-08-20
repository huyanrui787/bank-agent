"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  UserCog,
  AlertTriangle,
  Search,
  Sparkles,
  MessageSquare,
  ClipboardList,
  Bell,
  Radio,
  Database,
  GitBranch,
  ShieldCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/hooks/use-user"
import { useTasks } from "@/lib/hooks/use-tasks"
import type { LucideIcon } from "lucide-react"

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number }

const baseItems: NavItem[] = [
  { href: "/", label: "AI 工作台", icon: LayoutDashboard },
  { href: "/customer-segments", label: "客群梳理", icon: Users },
  { href: "/vertical-management", label: "垂直管理", icon: UserCog },
  { href: "/alerts", label: "业务预警", icon: AlertTriangle },
  { href: "/analysis", label: "查询分析", icon: Search },
  { href: "/qa", label: "问答助手", icon: MessageSquare },
  { href: "/skills", label: "Skill Center", icon: Sparkles },
  { href: "/workflow", label: "编排工作流", icon: GitBranch },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const { todayCount } = useTasks()

  const items: NavItem[] = [
    ...baseItems,
    ...(user?.permissions?.includes("manage_channels")
      ? [{ href: "/channels", label: "渠道配置", icon: Radio }]
      : []),
    ...(user?.permissions?.includes("manage_datasources")
      ? [{ href: "/datasources", label: "数据源", icon: Database }]
      : []),
    { href: "/tasks", label: "定时任务", icon: Bell, badge: todayCount },
    ...(user?.permissions?.includes("view_audit")
      ? [{ href: "/audit", label: "审计日志", icon: ClipboardList }]
      : []),
    ...(user?.permissions?.includes("manage_users")
      ? [{ href: "/permissions", label: "权限配置", icon: ShieldCheck }]
      : []),
  ]

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 px-5 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
          智
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">AI 客户经营助手</span>
          <span className="text-[10px] text-muted-foreground">龙湾农商行 · v1.0</span>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.badge && item.badge > 0 ? (
                <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none font-medium">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-3 border-t border-border text-xs text-muted-foreground space-y-1">
        <div>演示环境</div>
        <div>所有数据均为测试数据</div>
      </div>
    </aside>
  )
}
