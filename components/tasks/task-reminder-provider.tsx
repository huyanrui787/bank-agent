"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTasks } from "@/lib/hooks/use-tasks"

export function TaskReminderProvider({ children }: { children: React.ReactNode }) {
  const { tasks, refresh } = useTasks()
  const router = useRouter()
  // taskId -> 已提醒过的 lastFiredAt，避免重复弹窗
  const seenRef = useRef<Record<string, string>>({})

  // 轮询：每 30s 拉取最新任务，检测服务端新触发
  useEffect(() => {
    const timer = setInterval(refresh, 30_000)
    return () => clearInterval(timer)
  }, [refresh])

  // 检测新触发并弹提醒（只对最近 2 分钟内触发、且未提醒过的任务）
  useEffect(() => {
    const now = Date.now()
    for (const task of tasks) {
      const fired = task.lastFiredAt
      if (!fired) continue
      if (seenRef.current[task.id] === fired) continue
      seenRef.current[task.id] = fired

      const firedMs = new Date(fired).getTime()
      if (now - firedMs > 2 * 60_000) continue // 跳过历史触发

      const desc = task.description ?? (task.relatedCustomer ? `关联客户：${task.relatedCustomer}` : "定时提醒")
      toast(task.title, {
        description: desc,
        duration: 10_000,
        action: { label: "查看任务", onClick: () => router.push("/tasks") },
      })
    }
  }, [tasks, router])

  return <>{children}</>
}
