"use client"

import { useEffect, useState } from "react"
import { z } from "zod"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { nowMinuteLocal, WEEKDAY_LABELS } from "@/lib/tasks/types"
import type { TaskItem, RecurrenceRule } from "@/lib/tasks/types"

const schema = z.object({
  title: z.string().min(1, "标题不能为空").max(50, "标题不超过50字"),
  description: z.string().max(200).optional(),
  triggerAt: z.string().min(1, "请设置触发时间"),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
  weekday: z.number().min(0).max(6).optional(),
  monthDay: z.number().min(1).max(31).optional(),
  relatedCustomer: z.string().max(20).optional(),
})

type FormData = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: TaskItem
  onSubmit: (data: Omit<TaskItem, "id" | "userId" | "createdAt">) => void
}

export function TaskForm({ open, onOpenChange, initial, onSubmit }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [triggerAt, setTriggerAt] = useState("")
  const [recurrence, setRecurrence] = useState<RecurrenceRule>("none")
  const [weekday, setWeekday] = useState<number>(1)
  const [monthDay, setMonthDay] = useState<number>(1)
  const [relatedCustomer, setRelatedCustomer] = useState("")
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  // Populate form when editing
  useEffect(() => {
    if (initial) {
      setTitle(initial.title)
      setDescription(initial.description ?? "")
      setTriggerAt(initial.triggerAt.slice(0, 16))
      setRecurrence(initial.recurrence)
      setWeekday(initial.weekday ?? 1)
      setMonthDay(initial.monthDay ?? 1)
      setRelatedCustomer(initial.relatedCustomer ?? "")
    } else {
      setTitle("")
      setDescription("")
      // Default to 30 minutes from now
      const d = new Date(Date.now() + 30 * 60_000)
      const pad = (n: number) => String(n).padStart(2, "0")
      setTriggerAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
      setRecurrence("none")
      setWeekday(1)
      setMonthDay(1)
      setRelatedCustomer("")
    }
    setErrors({})
  }, [initial, open])

  function handleSubmit() {
    const raw = { title, description: description || undefined, triggerAt, recurrence,
      weekday: recurrence === "weekly" ? weekday : undefined,
      monthDay: recurrence === "monthly" ? monthDay : undefined,
      relatedCustomer: relatedCustomer || undefined,
    }
    const result = schema.safeParse(raw)
    if (!result.success) {
      const errs: typeof errors = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof FormData
        errs[key] = issue.message
      })
      setErrors(errs)
      return
    }
    onSubmit({
      ...result.data,
      enabled: initial?.enabled ?? true,
      done: initial?.done ?? false,
      lastFiredAt: initial?.lastFiredAt,
    })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial ? "编辑任务" : "新建定时任务"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Title */}
          <Field label="任务标题" required error={errors.title}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：联系张明确认存款续约"
              maxLength={50}
            />
          </Field>

          {/* Description */}
          <Field label="备注" error={errors.description}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选，补充说明…"
              maxLength={200}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </Field>

          {/* Trigger time */}
          <Field label="触发时间" required error={errors.triggerAt}>
            <input
              type="datetime-local"
              value={triggerAt}
              onChange={(e) => setTriggerAt(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>

          {/* Recurrence */}
          <Field label="重复规则" error={errors.recurrence}>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceRule)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不重复（一次性）</SelectItem>
                <SelectItem value="daily">每天</SelectItem>
                <SelectItem value="weekly">每周</SelectItem>
                <SelectItem value="monthly">每月</SelectItem>
              </SelectContent>
            </Select>

            {recurrence === "weekly" && (
              <div className="mt-2">
                <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="选择星期几" /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_LABELS.map((label, i) => (
                      <SelectItem key={i} value={String(i)}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {recurrence === "monthly" && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">每月</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={monthDay}
                  onChange={(e) => setMonthDay(Math.max(1, Math.min(31, Number(e.target.value))))}
                  className="w-20"
                />
                <span className="text-muted-foreground">日</span>
              </div>
            )}
          </Field>

          {/* Related customer */}
          <Field label="关联客户" error={errors.relatedCustomer}>
            <Input
              value={relatedCustomer}
              onChange={(e) => setRelatedCustomer(e.target.value)}
              placeholder="可选，如：张明"
              maxLength={20}
            />
          </Field>
        </div>

        <SheetFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit}>{initial ? "保存修改" : "创建任务"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
