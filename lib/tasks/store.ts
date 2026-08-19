import { getDb } from "@/lib/db"
import { nowMinuteLocal, shouldFire } from "./types"
import type { TaskItem, RecurrenceRule } from "./types"

type TaskRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  trigger_at: string
  recurrence: string
  weekday: number | null
  month_day: number | null
  related_customer: string | null
  enabled: number
  done: number
  last_fired_at: string | null
  created_at: string
}

function rowToTask(row: TaskRow): TaskItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? undefined,
    triggerAt: row.trigger_at,
    recurrence: row.recurrence as RecurrenceRule,
    weekday: row.weekday ?? undefined,
    monthDay: row.month_day ?? undefined,
    relatedCustomer: row.related_customer ?? undefined,
    enabled: Boolean(row.enabled),
    done: Boolean(row.done),
    lastFiredAt: row.last_fired_at ?? undefined,
    createdAt: row.created_at,
  }
}

export function listTasks(userId: string): TaskItem[] {
  const rows = getDb()
    .prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as TaskRow[]
  return rows.map(rowToTask)
}

export type TaskDraft = Omit<TaskItem, "id" | "userId" | "createdAt">

export function createTask(userId: string, draft: TaskDraft): TaskItem {
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO tasks
        (id, user_id, title, description, trigger_at, recurrence, weekday, month_day,
         related_customer, enabled, done, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      id, userId, draft.title, draft.description ?? null, draft.triggerAt, draft.recurrence,
      draft.weekday ?? null, draft.monthDay ?? null, draft.relatedCustomer ?? null,
      draft.enabled ? 1 : 0, draft.done ? 1 : 0, createdAt
    )
  return { id, userId, createdAt, ...draft }
}

export function updateTask(userId: string, id: string, patch: Partial<TaskDraft>): boolean {
  const sets: string[] = []
  const vals: unknown[] = []
  if (patch.title !== undefined)           { sets.push("title = ?");           vals.push(patch.title) }
  if (patch.description !== undefined)     { sets.push("description = ?");     vals.push(patch.description ?? null) }
  if (patch.triggerAt !== undefined)       { sets.push("trigger_at = ?");      vals.push(patch.triggerAt) }
  if (patch.recurrence !== undefined)      { sets.push("recurrence = ?");      vals.push(patch.recurrence) }
  if (patch.weekday !== undefined)         { sets.push("weekday = ?");         vals.push(patch.weekday ?? null) }
  if (patch.monthDay !== undefined)        { sets.push("month_day = ?");       vals.push(patch.monthDay ?? null) }
  if (patch.relatedCustomer !== undefined) { sets.push("related_customer = ?"); vals.push(patch.relatedCustomer ?? null) }
  if (patch.enabled !== undefined)         { sets.push("enabled = ?");         vals.push(patch.enabled ? 1 : 0) }
  if (patch.done !== undefined)            { sets.push("done = ?");            vals.push(patch.done ? 1 : 0) }
  if (patch.lastFiredAt !== undefined)     { sets.push("last_fired_at = ?");   vals.push(patch.lastFiredAt ?? null) }
  if (sets.length === 0) return true

  vals.push(id, userId)
  const info = getDb()
    .prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`)
    .run(...vals)
  return info.changes > 0
}

export function deleteTask(userId: string, id: string): boolean {
  const info = getDb().prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(id, userId)
  return info.changes > 0
}

/**
 * 服务端定时触发：扫描所有到期任务，标记触发（幂等，last_fired_at 防同一分钟重复触发）。
 * 一次性任务触发后置 done=1；重复任务保持 done=0，仅更新 last_fired_at。
 */
export function tickTasks(): TaskItem[] {
  const db = getDb()
  const now = nowMinuteLocal()
  const rows = db.prepare("SELECT * FROM tasks WHERE enabled = 1 AND done = 0").all() as TaskRow[]
  const fired: TaskItem[] = []

  for (const row of rows) {
    const task = rowToTask(row)
    if (shouldFire(task, now)) {
      const done = task.recurrence === "none" ? 1 : 0
      db.prepare("UPDATE tasks SET last_fired_at = ?, done = ? WHERE id = ?").run(now, done, task.id)
      fired.push({ ...task, lastFiredAt: now, done: done === 1 })
    }
  }
  return fired
}
