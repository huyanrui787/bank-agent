import { NextRequest } from "next/server"
import { getDb } from "@/lib/db"
import { userFromHeaders } from "@/lib/auth/scope"
import { executeWorkflow } from "@/lib/workflow/executor"
import type { WorkflowDefinition, WorkflowRunEvent } from "@/lib/workflow/types"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = userFromHeaders(req.headers)
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })

  const row = getDb().prepare("SELECT definition FROM workflows WHERE id = ?").get(id) as { definition: string } | undefined
  if (!row) return new Response(JSON.stringify({ error: "工作流不存在" }), { status: 404 })

  const body = await req.json().catch(() => ({})) as { input?: string; vars?: Record<string, unknown> }
  const definition = JSON.parse(row.definition) as WorkflowDefinition
  const inputVars: Record<string, unknown> = { input: body.input ?? "", ...body.vars }

  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of executeWorkflow(definition, inputVars, {
          userId: user.sub, userName: user.name, role: user.role,
        })) {
          const line = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(enc.encode(line))
        }
      } catch (err) {
        const errEvent: WorkflowRunEvent = { type: "flow_error", error: err instanceof Error ? err.message : String(err) }
        controller.enqueue(enc.encode(`data: ${JSON.stringify(errEvent)}\n\n`))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  })
}
