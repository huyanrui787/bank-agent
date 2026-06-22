export type RecurrenceRule = "none" | "daily" | "weekly" | "monthly"

export type TaskItem = {
  id: string
  userId: string
  title: string
  description?: string
  triggerAt: string        // local datetime string "YYYY-MM-DDTHH:mm"
  recurrence: RecurrenceRule
  weekday?: number         // 0=Sun…6=Sat, used when recurrence="weekly"
  monthDay?: number        // 1-31, used when recurrence="monthly"
  relatedCustomer?: string
  enabled: boolean
  done: boolean            // one-shot task: true after first fire
  lastFiredAt?: string     // "YYYY-MM-DDTHH:mm" local, prevents same-minute re-fire
  createdAt: string
}

// Returns local datetime string "YYYY-MM-DDTHH:mm" for the current minute
export function nowMinuteLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function todayLocal(): string {
  return nowMinuteLocal().slice(0, 10)
}

export function shouldFire(task: TaskItem, nowMinute: string): boolean {
  if (!task.enabled || task.done) return false
  if (task.lastFiredAt === nowMinute) return false

  const taskHHmm = task.triggerAt.slice(11, 16)   // "HH:mm"
  const nowHHmm  = nowMinute.slice(11, 16)
  const timeMatch = taskHHmm === nowHHmm

  switch (task.recurrence) {
    case "none":
      return task.triggerAt.slice(0, 16) === nowMinute
    case "daily":
      return timeMatch
    case "weekly": {
      const today = new Date()
      return today.getDay() === (task.weekday ?? -1) && timeMatch
    }
    case "monthly": {
      const today = new Date()
      return today.getDate() === (task.monthDay ?? -1) && timeMatch
    }
    default:
      return false
  }
}

export const RECURRENCE_LABELS: Record<RecurrenceRule, string> = {
  none: "不重复",
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
}

export const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
