/**
 * 服务端定时任务调度：仅在 Node.js 运行时启动一个 30s 间隔的 tick，
 * 扫描到期任务并标记触发，触发后经「渠道配置」推送通知（无需浏览器打开）。
 * register() 在每个 Next.js 服务实例启动时调用一次。
 * 注意：instrumentation 会被 Edge 运行时也加载一次，必须用动态 import
 * 隔离 Node 专属模块（better-sqlite3），避免 Edge 加载失败。
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "edge") return

  const g = globalThis as typeof globalThis & { __bankTaskSchedulerStarted?: boolean }
  if (g.__bankTaskSchedulerStarted) return
  g.__bankTaskSchedulerStarted = true

  Promise.all([
    import("@/lib/tasks/store"),
    import("@/lib/channels/dispatch"),
  ]).then(([{ tickTasks, markTaskFired }, { notifyAllChannels, listEnabledChannels }]) => {
    const tick = async () => {
      try {
        const due = tickTasks()
        for (const task of due) {
          const results = await notifyAllChannels({
            title: `⏰ 定时任务：${task.title}`,
            content: [
              task.description ? `说明：${task.description}` : null,
              task.relatedCustomer ? `客户：${task.relatedCustomer}` : null,
              `触发时间：${task.triggerAt}`,
            ].filter(Boolean).join("\n"),
            smsName: task.relatedCustomer,
          })
          // 仅当至少一个渠道真正送达成功，才标记任务已触发；否则保持 pending 下个周期重试。
          const delivered = results.length > 0 && results.some((r) => r.status === "success")
          if (delivered) {
            markTaskFired(task.id, task.recurrence === "none")
          } else {
            console.warn(
              `[scheduler] 任务「${task.title}」提醒未送达（${results.length === 0 ? "无可用渠道" : "渠道发送失败"}），下个周期重试`
            )
          }
        }
      } catch (err) {
        console.error("[scheduler] tick failed:", err)
      }
    }

    console.log("[scheduler] started")
    if (listEnabledChannels().length === 0) {
      console.warn("[scheduler] 未配置任何通知渠道：定时任务触发后无法送达提醒，请在「渠道配置」中添加并启用渠道。")
    }
    tick()
    setInterval(tick, 30_000)
  }).catch((err) => {
    console.error("[scheduler] failed to start:", err)
  })
}
