"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Shield } from "lucide-react"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      if (res.ok) {
        router.replace("/")
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "用户名或密码错误")
      }
    } catch {
      toast.error("网络错误，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
            智
          </div>
          <h1 className="text-xl font-semibold">AI 客户经营助手</h1>
          <p className="mt-1 text-sm text-muted-foreground">龙湾农村商业银行</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="username">
              用户名
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入工号或用户名"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "登录中…" : "登 录"}
          </button>
        </form>

        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Shield className="h-3 w-3" /> 演示账号（密码均为 demo123，点击填入）
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {[
              { username: "lixue", label: "客户经理" },
              { username: "zhoujianhua", label: "支行负责人" },
              { username: "admin", label: "分行管理员" },
              { username: "compliance", label: "合规审计" },
            ].map((demo) => (
              <button
                key={demo.username}
                type="button"
                disabled={loading}
                onClick={() => {
                  setUsername(demo.username)
                  setPassword("demo123")
                }}
                className="text-left hover:text-primary hover:underline disabled:opacity-50"
              >
                {demo.username} — {demo.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
