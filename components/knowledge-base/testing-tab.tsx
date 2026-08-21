"use client"

import { useState } from "react"
import { Search, Loader2, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

type TestChunk = {
  content: string
  similarity: number
  vectorSimilarity: number
  termSimilarity: number
  source: string
  positions: number[][]
}

export function TestingTab({ datasetId }: { datasetId: string }) {
  const [query, setQuery] = useState("")
  const [topK, setTopK] = useState(5)
  const [threshold, setThreshold] = useState(0.2)
  const [loading, setLoading] = useState(false)
  const [chunks, setChunks] = useState<TestChunk[]>([])
  const [total, setTotal] = useState(0)
  const [tested, setTested] = useState(false)

  async function handleTest() {
    if (!query.trim()) { toast.error("请输入检索问题"); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), topK, similarityThreshold: threshold, highlight: false }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "检索失败"); return }
      const d = await res.json()
      setChunks(d.chunks ?? [])
      setTotal(d.total ?? 0)
      setTested(true)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-52 space-y-1.5">
          <label className="text-xs text-muted-foreground">检索问题</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入问题，测试检索效果"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleTest() }}
          />
        </div>
        <div className="w-24 space-y-1.5">
          <label className="text-xs text-muted-foreground">召回条数</label>
          <Input type="number" min={1} max={50} value={topK} onChange={(e) => setTopK(Number(e.target.value) || 5)} />
        </div>
        <div className="w-28 space-y-1.5">
          <label className="text-xs text-muted-foreground">相似度阈值</label>
          <Input type="number" step={0.05} min={0} max={1} value={threshold} onChange={(e) => setThreshold(Number(e.target.value) || 0.2)} />
        </div>
        <Button size="sm" onClick={handleTest} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
          测试
        </Button>
      </div>

      {tested && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">命中 {total} 条相关片段</p>
          {chunks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">无命中，可降低相似度阈值重试。</p>
          ) : (
            chunks.map((c, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      相似度 {(c.similarity * 100).toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      向量 {c.vectorSimilarity.toFixed(3)} · 词法 {c.termSimilarity.toFixed(3)}
                    </span>
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground truncate">{c.source}</span>
                    {c.positions?.[0]?.[0] != null && (
                      <span className="text-[10px] text-muted-foreground">第 {c.positions[0][0]} 页</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed line-clamp-4 whitespace-pre-wrap">{c.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
