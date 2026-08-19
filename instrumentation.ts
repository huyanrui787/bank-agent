/**
 * 服务端定时任务调度：仅在 Node.js 运行时启动一个 30s 间隔的 tick，
 * 扫描到期任务并标记触发（无需浏览器打开）。
 * register() 在每个 Next.js 服务实例启动时调用一次。
 * 注意：instrumentation 会被 Edge 运行时也加载一次，必须用动态 import
 * 隔离 Node 专属模块（better-sqlite3），避免 Edge 加载失败。
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "edge") return

  const g = globalThis as typeof globalThis & { __bankTaskSchedulerStarted?: boolean }
  if (g.__bankTaskSchedulerStarted) return
  g.__bankTaskSchedulerStarted = true

  import("@/lib/tasks/store").then(({ tickTasks }) => {
    const tick = () => {
      try {
        tickTasks()
      } catch (err) {
        console.error("[scheduler] tick failed:", err)
      }
    }
    tick()
    setInterval(tick, 30_000)
  })
}
