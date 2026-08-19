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
  ]).then(([{ tickTasks }, { notifyAllChannels }]) => {
    const tick = async () => {
      try {
        const fired = tickTasks()
        for (const task of fired) {
          await notifyAllChannels({
            title: `⏰ 定时任务：${task.title}`,
            content: [
              task.description ? `说明：${task.description}` : null,
              task.relatedCustomer ? `客户：${task.relatedCustomer}` : null,
              `触发时间：${task.triggerAt}`,
            ].filter(Boolean).join("\n"),
            smsName: task.relatedCustomer,
          })
        }
      } catch (err) {
        console.error("[scheduler] tick failed:", err)
      }
    }

    console.log("[scheduler] started")
    tick()
    setInterval(tick, 30_000)
  }).catch((err) => {
    console.error("[scheduler] failed to start:", err)
  })
}
