import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { searchKnowledge } from "@/lib/mock/knowledge-base"
import { callLlm } from "@/lib/agent/llm"
import { userFromHeaders } from "@/lib/auth/scope"
import { writeAuditLog } from "@/lib/audit/log"

const qaSchema = z.object({
  question: z.string().min(1).max(500),
})

const SYSTEM_PROMPT = `你是「丰年银行」的 AI 合规问答助手，专门回答客户经理关于贷款政策、利率、合规要求、贷前调查、产品准入等内部业务问题。

回答要求：
1. 用简洁专业的中文回答，不超过 300 字
2. 如果涉及具体政策条款，请注明文件来源（如《小微企业信贷管理办法》第X条）
3. 如果问题超出银行业务范围，礼貌说明无法回答
4. 不要编造不确定的数据或政策，如不确定请说明
5. 回答格式：先给出直接答案，再补充说明依据`

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const user = userFromHeaders(req.headers)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = qaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }

  const question = parsed.data.question
  const kbResults = searchKnowledge(question)

  const turn = await callLlm({
    instructions: SYSTEM_PROMPT,
    input: [{ role: "user", content: [{ type: "input_text", text: question }] }],
  })

  const answer = turn.text.trim()

  writeAuditLog({
    actorId: user.sub,
    actorName: user.name,
    actorRole: user.role,
    actorBranch: user.branch,
    action: "ai.chat.query",
    resourceType: "qa",
    summary: `${user.name} 合规问答：${question.slice(0, 80)}`,
    detail: { question: question.slice(0, 300), answerLength: answer.length },
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
    requestId: req.headers.get("x-request-id") ?? null,
    dataScope: null,
  })

  return NextResponse.json({
    answer,
    sources: kbResults.slice(0, 2).map((r) => ({
      id: r.id, category: r.category, question: r.question, source: r.source,
    })),
    matched: true,
    _mode: "llm",
  })
}
