import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { listTasks, createTask } from "@/lib/tasks/store"
import { listEnabledChannels } from "@/lib/channels/dispatch"

export const runtime = "nodejs"

const taskSchema = z.object({
  title: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  triggerAt: z.string().min(1),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
  weekday: z.number().min(0).max(6).optional(),
  monthDay: z.number().min(1).max(31).optional(),
  relatedCustomer: z.string().max(20).optional(),
  enabled: z.boolean().default(true),
  done: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return NextResponse.json({
    tasks: listTasks(user.sub),
    channelsEnabled: listEnabledChannels().length,
  })
}

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = taskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })
  }

  const task = createTask(user.sub, parsed.data)
  return NextResponse.json({ task }, { status: 201 })
}
