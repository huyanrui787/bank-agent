"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTasks } from "@/lib/hooks/use-tasks"
import { shouldFire, nowMinuteLocal } from "@/lib/tasks/types"

export function TaskReminderProvider({ children }: { children: React.ReactNode }) {
  const { tasks, markFired } = useTasks()
  const router = useRouter()
  // Keep a stable ref so the interval always sees the latest tasks
  const tasksRef = useRef(tasks)
  const markFiredRef = useRef(markFired)
  useEffect(() => { tasksRef.current = tasks }, [tasks])
  useEffect(() => { markFiredRef.current = markFired }, [markFired])

  useEffect(() => {
    function check() {
      const nowMinute = nowMinuteLocal()
      for (const task of tasksRef.current) {
        if (shouldFire(task, nowMinute)) {
          const desc = task.description
            ?? (task.relatedCustomer ? `关联客户：${task.relatedCustomer}` : "定时提醒")
          toast(task.title, {
            description: desc,
            duration: 10_000,
            action: {
              label: "查看任务",
              onClick: () => router.push("/tasks"),
            },
          })
          markFiredRef.current(task.id, nowMinute)
        }
      }
    }

    check() // check immediately on mount / tasks change
    const timer = setInterval(check, 60_000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only mount once; refs keep values current

  return <>{children}</>
}
