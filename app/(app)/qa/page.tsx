"use client"

import { useState } from "react"
import { toast } from "sonner"
import { BookOpen, MessageSquare, Search, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { knowledgeBase } from "@/lib/mock/knowledge-base"

type QaSource = {
  id: string
  category: string
  question: string
  source: string
}

type QaResult = {
  answer: string
  sources: QaSource[]
  matched: boolean
  _mode?: "llm" | "kb"
}

const examples = [
  "小微企业贷款最高额度是多少？",
  "当前 LPR 利率是多少？",
  "反洗钱大额交易报告标准",
  "贷款展期的条件和流程",
  "黑名单和限入名单的区别",
  "数据宝查询使用规范",
]

const categoryColors: Record<string, string> = {
  贷款政策: "bg-blue-50 text-blue-700 border-blue-200",
  利率: "bg-green-50 text-green-700 border-green-200",
  合规要求: "bg-orange-50 text-orange-700 border-orange-200",
  贷前调查: "bg-purple-50 text-purple-700 border-purple-200",
  产品准入: "bg-red-50 text-red-700 border-red-200",
}

export default function QaPage() {
  const [question, setQuestion] = useState("")
  const [result, setResult] = useState<QaResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{ q: string; r: QaResult }[]>([])
  const [kbOpen, setKbOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function ask(q?: string) {
    const input = (q ?? question).trim()
    if (!input) return
    setLoading(true)
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: input }),
      })
      const data = (await res.json()) as QaResult
      setResult(data)
      setHistory((prev) => [{ q: input, r: data }, ...prev.slice(0, 9)])
      if (!data.matched) {
        toast.info("未找到精确匹配，已返回通用建议")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-6 py-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">问答助手</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查询贷款政策、利率、合规要求等内部知识，每条答案均标注文件来源。
          </p>
        </div>
        <button onClick={() => setKbOpen(true)}>
          <Badge variant="info" className="cursor-pointer hover:opacity-80 transition-opacity">
            <BookOpen className="h-3 w-3" /> 内置 15 条知识库
          </Badge>
        </button>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <Textarea
            placeholder="输入问题，例如：小微企业贷款最高额度是多少？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask()
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {examples.slice(0, 4).map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setQuestion(ex); ask(ex) }}
                  className="text-xs px-2 py-1 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
            <Button onClick={() => ask()} disabled={loading || !question.trim()} size="sm">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" /> 查询中…
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" /> 查询
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              AI 答复
              {result._mode === "llm" ? (
                <Badge variant="success" className="text-[10px]">真实 AI</Badge>
              ) : (
                <Badge variant="muted" className="text-[10px]">知识库匹配</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm leading-7 whitespace-pre-wrap bg-secondary/30 rounded-md p-4">
              {result.answer}
            </div>

            {result.sources.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    文件来源
                  </div>
                  <div className="space-y-2">
                    {result.sources.map((s) => (
                      <div key={s.id} className="flex items-start gap-2 text-xs">
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                            categoryColors[s.category] ?? "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {s.category}
                        </span>
                        <div className="space-y-0.5">
                          <div className="text-foreground">{s.question}</div>
                          <div className="text-muted-foreground">{s.source}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {history.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">历史查询</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.slice(1).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setQuestion(h.q); setResult(h.r) }}
                  className="w-full text-left text-xs px-3 py-2 rounded-md border border-border hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {h.q}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={kbOpen} onOpenChange={setKbOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              内置知识库（{knowledgeBase.length} 条）
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {knowledgeBase.map((item) => (
              <div key={item.id} className="rounded-lg border border-border overflow-hidden">
                <button
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-medium ${categoryColors[item.category] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {item.category}
                    </span>
                    <span className="text-sm font-medium truncate">{item.question}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {expandedId === item.id ? "收起" : "展开"}
                  </span>
                </button>
                {expandedId === item.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border bg-muted/20">
                    <p className="text-sm leading-6 text-foreground pt-3">{item.answer}</p>
                    <p className="text-xs text-muted-foreground">来源：{item.source}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
