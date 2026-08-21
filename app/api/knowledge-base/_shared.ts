import { NextResponse } from "next/server"
import { RagflowError } from "@/lib/ragflow/client"

/** 把 RAGFlow 客户端错误转成对应 HTTP 状态码的响应 */
export function ragflowErrorResponse(err: unknown) {
  if (err instanceof RagflowError) {
    const status = err.code === "not_configured" ? 503 : 502
    return NextResponse.json({ error: err.message }, { status })
  }
  return NextResponse.json({ error: "知识库服务异常" }, { status: 500 })
}
