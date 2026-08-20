"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@/lib/hooks/use-user"
import { todayLocal } from "@/lib/tasks/types"
import type { TaskItem } from "@/lib/tasks/types"

export function useTasks() {
  const { user } = useUser()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [channelsEnabled, setChannelsEnabled] = useState(0)

  const refresh = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await fetch("/api/tasks")
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks ?? [])
        setChannelsEnabled(data.channelsEnabled ?? 0)
      }
    } catch { /* 忽略网络错误 */ }
  }, [user])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 挂载/用户切换时拉取任务列表 */
    refresh()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh])

  const addTask = useCallback(async (draft: Omit<TaskItem, "id" | "userId" | "createdAt">) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
    if (res.ok) await refresh()
  }, [refresh])

  const updateTask = useCallback(async (id: string, patch: Partial<TaskItem>) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (res.ok) await refresh()
  }, [refresh])

  const deleteTask = useCallback(async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    await refresh()
  }, [refresh])

  const toggleEnabled = useCallback(async (id: string) => {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    await updateTask(id, { enabled: !t.enabled })
  }, [tasks, updateTask])

  // Today's pending tasks count (for sidebar badge)
  const today = todayLocal()
  const todayCount = tasks.filter((t) => {
    if (!t.enabled || t.done) return false
    if (t.recurrence === "none") return t.triggerAt.slice(0, 10) === today
    return true
  }).length

  return { tasks, addTask, updateTask, deleteTask, toggleEnabled, refresh, todayCount, channelsEnabled }
}
