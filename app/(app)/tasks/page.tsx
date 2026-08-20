"use client"

import { useState, useMemo } from "react"
import { Plus, Bell, BellOff, Pencil, Trash2, CheckCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskForm } from "@/components/tasks/task-form"
import { useTasks } from "@/lib/hooks/use-tasks"
import {
  todayLocal, RECURRENCE_LABELS, WEEKDAY_LABELS,
} from "@/lib/tasks/types"
import type { TaskItem } from "@/lib/tasks/types"

function recurrenceDescription(task: TaskItem): string {
  switch (task.recurrence) {
    case "none":    return "一次性"
    case "daily":   return `每天 ${task.triggerAt.slice(11, 16)}`
    case "weekly":  return `每${WEEKDAY_LABELS[task.weekday ?? 0]} ${task.triggerAt.slice(11, 16)}`
    case "monthly": return `每月${task.monthDay ?? 1}日 ${task.triggerAt.slice(11, 16)}`
  }
}

function formatTrigger(task: TaskItem): string {
  if (task.recurrence !== "none") return recurrenceDescription(task)
  const d = new Date(task.triggerAt)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TasksPage() {
  const { tasks, addTask, updateTask, deleteTask, toggleEnabled, channelsEnabled } = useTasks()
  const [tab, setTab] = useState<"today" | "all">("today")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TaskItem | undefined>()

  const today = todayLocal()

  const todayTasks = useMemo(() => tasks.filter((t) => {
    if (t.recurrence === "none") return t.triggerAt.slice(0, 10) === today
    return true
  }), [tasks, today])

  const displayTasks = tab === "today" ? todayTasks : tasks
  const sorted = [...displayTasks].sort((a, b) => {
    // enabled first, then by trigger time
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return a.triggerAt.localeCompare(b.triggerAt)
  })

  function openNew() {
    setEditing(undefined)
    setFormOpen(true)
  }

  function openEdit(task: TaskItem) {
    setEditing(task)
    setFormOpen(true)
  }

  function handleDelete(task: TaskItem) {
    if (!confirm(`确定删除任务「${task.title}」？`)) return
    deleteTask(task.id)
    toast.success("任务已删除")
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">定时任务</h1>
          <span className="text-sm text-muted-foreground">共 {tasks.length} 个</span>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新建任务
        </Button>
      </div>

      {/* 无通知渠道提示：任务不会静默丢失，但触发后无法送达提醒 */}
      {channelsEnabled === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          尚未配置通知渠道，定时任务触发后将无法发送提醒。请联系管理员在「渠道配置」中添加并启用渠道（企业微信 / 龙龙 / 短信 / 自定义 Webhook）。
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="today" className="flex items-center gap-1">
            今日
            {todayTasks.length > 0 && (
              <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none">
                {todayTasks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">全部</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Task list */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Clock className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {tab === "today" ? "今日暂无定时任务" : "还没有定时任务"}
            </p>
            <Button variant="outline" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              创建第一个任务
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={() => openEdit(task)}
              onDelete={() => handleDelete(task)}
              onToggle={() => toggleEnabled(task.id)}
              formatTrigger={formatTrigger}
            />
          ))}
        </div>
      )}

      {/* Create / edit sheet */}
      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={(data) => {
          if (editing) {
            updateTask(editing.id, data)
            toast.success("任务已更新")
          } else {
            addTask(data)
            toast.success("任务已创建")
          }
        }}
      />
    </div>
  )
}

function TaskCard({
  task, onEdit, onDelete, onToggle, formatTrigger,
}: {
  task: TaskItem
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  formatTrigger: (t: TaskItem) => string
}) {
  return (
    <Card className={task.done || !task.enabled ? "opacity-60" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Left: status icon */}
          <div className="mt-0.5 shrink-0">
            {task.done ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : task.enabled ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {/* Center: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{task.title}</span>
              {task.done && (
                <Badge variant="muted" className="text-[10px]">已触发</Badge>
              )}
              {!task.enabled && !task.done && (
                <Badge variant="muted" className="text-[10px]">已暂停</Badge>
              )}
              {task.recurrence !== "none" && (
                <Badge variant="outline" className="text-[10px]">
                  {RECURRENCE_LABELS[task.recurrence]}
                </Badge>
              )}
            </div>

            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>
            )}

            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTrigger(task)}
              </span>
              {task.relatedCustomer && (
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                  {task.relatedCustomer}
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 shrink-0">
            {!task.done && (
              <button
                onClick={onToggle}
                title={task.enabled ? "暂停" : "启用"}
                className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                {task.enabled ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              </button>
            )}
            <button
              onClick={onEdit}
              title="编辑"
              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              title="删除"
              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
