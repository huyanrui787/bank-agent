"use client"

import { useState } from "react"
import { Search, Loader2, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"

type TestChunk = {
  content: string
  similarity: number
  vectorSimilarity: number
  termSimilarity: number
  source: string
  positions: number[][]
}
type DocAgg = { docName: string; docId: string; count: number }

export function TestingTab({ datasetId }: { datasetId: string }) {
  const [query, setQuery] = useState("")
  const [threshold, setThreshold] = useState(0.2)
  const [vectorWeight, setVectorWeight] = useState(0.3)
  const [size, setSize] = useState(10)
  const [docFilter, setDocFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [chunks, setChunks] = useState<TestChunk[]>([])
  const [docAggs, setDocAggs] = useState<DocAgg[]>([])
  const [total, setTotal] = useState(0)
  const [tested, setTested] = useState(false)

  async function runTest() {
    if (!query.trim()) { toast.error("请输入检索问题"); return }
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        query: query.trim(),
        topK: size,
        similarityThreshold: threshold,
        vectorSimilarityWeight: vectorWeight,
        highlight: false,
      }
      if (docFilter !== "all") body.documentIds = [docFilter]
      const res = await fetch(`/api/knowledge-base/datasets/${datasetId}/test`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "检索失败"); return }
      const d = await res.json()
      setChunks(d.chunks ?? [])
      setDocAggs(d.docAggs ?? [])
      setTotal(d.total ?? 0)
      setTested(true)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">检索问题</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入问题，测试检索效果"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) runTest() }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">相似度阈值</label>
              <span className="text-xs">{threshold.toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">向量权重</label>
              <span className="text-xs">{vectorWeight.toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={vectorWeight} onChange={(e) => setVectorWeight(Number(e.target.value))} className="w-full" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">结果条数</label>
            <Select value={String(size)} onValueChange={(v) => setSize(Number(v))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 条</SelectItem>
                <SelectItem value="20">20 条</SelectItem>
                <SelectItem value="50">50 条</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">来源文件过滤</label>
            <Select value={docFilter} onValueChange={setDocFilter}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部文件</SelectItem>
                {docAggs.map((a) => (
                  <SelectItem key={a.docId} value={a.docId}>{a.docName}（{a.count}）</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button size="sm" onClick={runTest} disabled={loading}>
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
