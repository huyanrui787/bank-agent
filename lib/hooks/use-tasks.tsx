"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@/lib/hooks/use-user"
import type { TaskItem } from "@/lib/tasks/types"
import { todayLocal } from "@/lib/tasks/types"
import { randomId } from "@/lib/utils"

function storageKey(userId: string) {
  return `bank_tasks_${userId}`
}

function pruneOldDone(list: TaskItem[]): TaskItem[] {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  return list.filter((t) => !(t.done && t.createdAt < sevenDaysAgo))
}

export function useTasks() {
  const { user } = useUser()
  const [tasks, setTasks] = useState<TaskItem[]>([])

  useEffect(() => {
    if (!user?.id) { setTasks([]); return }
    try {
      const raw = localStorage.getItem(storageKey(user.id))
      setTasks(raw ? (JSON.parse(raw) as TaskItem[]) : [])
    } catch {
      setTasks([])
    }
  }, [user?.id])

  const save = useCallback((list: TaskItem[]) => {
    setTasks(list)
    if (user?.id) {
      localStorage.setItem(storageKey(user.id), JSON.stringify(list))
    }
  }, [user?.id])

  const addTask = useCallback((draft: Omit<TaskItem, "id" | "userId" | "createdAt">) => {
    if (!user?.id) return
    const pruned = pruneOldDone(tasks)
    const newItem: TaskItem = {
      ...draft,
      id: randomId(),
      userId: user.id,
      createdAt: new Date().toISOString(),
    }
    save([...pruned, newItem])
  }, [tasks, save, user?.id])

  const updateTask = useCallback((id: string, patch: Partial<TaskItem>) => {
    save(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [tasks, save])

  const deleteTask = useCallback((id: string) => {
    save(tasks.filter((t) => t.id !== id))
  }, [tasks, save])

  const toggleEnabled = useCallback((id: string) => {
    save(tasks.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)))
  }, [tasks, save])

  const markFired = useCallback((id: string, minute: string) => {
    save(tasks.map((t) => {
      if (t.id !== id) return t
      return {
        ...t,
        lastFiredAt: minute,
        done: t.recurrence === "none" ? true : t.done,
      }
    }))
  }, [tasks, save])

  // Today's pending tasks count (for sidebar badge)
  const today = todayLocal()
  const todayCount = tasks.filter((t) => {
    if (!t.enabled || t.done) return false
    if (t.recurrence === "none") return t.triggerAt.slice(0, 10) === today
    return true
  }).length

  return { tasks, addTask, updateTask, deleteTask, toggleEnabled, markFired, todayCount }
}
