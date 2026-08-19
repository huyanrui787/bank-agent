import { NextRequest } from "next/server"
import { z } from "zod"
import { streamLlmAgent, isLlmConfigured } from "@/lib/agent/llm-agent"
import { streamMockAgent } from "@/lib/agent/mock-tools"
import { getSkillPrompts, BUILTIN_SKILLS } from "@/lib/agent/skill-store"
import { userFromHeaders, buildScope } from "@/lib/auth/scope"
import { writeAuditLog } from "@/lib/audit/log"
import { getDb } from "@/lib/db"
import type { StreamEvent, AgentResponse } from "@/lib/agent/types"
import type { Skill } from "@/lib/agent/skill-store"

const schema = z.object({
  message: z.string().min(1).max(500),
  skillIds: z.array(z.string()).optional(),
  skillOverrides: z.record(z.string(), z.string()).optional(),
})

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  let parsed
  try {
    const body = await req.json()
    parsed = schema.safeParse(body)
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 })
  }
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid_input" }), { status: 400 })
  }

  const { message, skillIds = [], skillOverrides = {} } = parsed.data

  // Merge builtin + custom skills for prompt resolution
  const db = getDb()
  const customRows = db.prepare(
    "SELECT id, name, description, category, input_schema_description AS prompt, enabled FROM custom_skills WHERE enabled = 1"
  ).all() as { id: string; name: string; description: string; category: string; prompt: string; enabled: number }[]
  const allSkills: Skill[] = [
    // Apply client-side overrides for builtin skills
    ...BUILTIN_SKILLS.map((s): Skill => {
      const ov = skillOverrides[s.id]
      return ov ? { ...s, prompt: ov } : s
    }),
    ...customRows.map((r) => ({ id: r.id, name: r.name, description: r.description ?? "", category: r.category ?? "自定义", prompt: r.prompt ?? "", icon: "Sparkles", source: "custom" as const })),
  ]
  const skillPrompts = getSkillPrompts(skillIds, allSkills)
  const scope = buildScope(user)
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()
  const ip = req.headers.get("x-forwarded-for") ?? null

  const enc = new TextEncoder()
  let finalResponse: AgentResponse | null = null
  const useMock = process.env.USE_MOCK_AGENT === "true" || !isLlmConfigured()

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: StreamEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`))

      try {
        if (useMock) {
          for await (const event of streamMockAgent(message)) {
            enqueue(event)
            if (event.type === "done") finalResponse = event.response
          }
        } else {
          try {
            for await (const event of streamLlmAgent(message, skillPrompts, { user, scope })) {
              enqueue(event)
              if (event.type === "done") finalResponse = event.response
            }
          } catch (err) {
            // LLM 运行时失败 → 自动降级到 deterministic mock，保证现场演示稳定
            const errMsg = err instanceof Error ? err.message : String(err)
            for await (const event of streamMockAgent(message)) {
              if (event.type === "done") {
                const fallback: AgentResponse = { ...event.response, _agent: "mock-fallback", _llmError: errMsg }
                finalResponse = fallback
                enqueue({ type: "done", response: fallback })
              } else {
                enqueue(event)
              }
            }
          }
        }
      } catch (err) {
        enqueue({ type: "error", message: err instanceof Error ? err.message : String(err) })
      }
      controller.close()

      // Write audit log after stream completes
      writeAuditLog({
        actorId: user.sub,
        actorName: user.name,
        actorRole: user.role,
        actorBranch: user.branch,
        action: "ai.chat.query",
        resourceType: "ai_response",
        summary: `AI 查询：${message.slice(0, 100)}`,
        detail: {
          message: message.slice(0, 500),
          responseSummary: finalResponse?.summary?.slice(0, 200),
          intent: finalResponse?.intent,
          resultType: finalResponse?.resultType,
        },
        ipAddress: ip,
        requestId,
        dataScope: scope.label,
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

