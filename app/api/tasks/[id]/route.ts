import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { userFromHeaders } from "@/lib/auth/scope"
import { updateTask, deleteTask } from "@/lib/tasks/store"

export const runtime = "nodejs"

const updateSchema = z.object({
  title: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional(),
  triggerAt: z.string().min(1).optional(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
  weekday: z.number().min(0).max(6).optional(),
  monthDay: z.number().min(1).max(31).optional(),
  relatedCustomer: z.string().max(20).optional(),
  enabled: z.boolean().optional(),
  done: z.boolean().optional(),
  lastFiredAt: z.string().optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", issues: parsed.error.issues }, { status: 400 })
  }

  const ok = updateTask(user.sub, id, parsed.data)
  if (!ok) return NextResponse.json({ error: "任务不存在" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  deleteTask(user.sub, id)
  return NextResponse.json({ ok: true })
}
