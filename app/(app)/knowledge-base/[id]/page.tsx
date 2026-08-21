"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, FileText, TextSearch, ScrollText, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { DocumentsTab } from "@/components/knowledge-base/documents-tab"
import { TestingTab } from "@/components/knowledge-base/testing-tab"
import { LogsTab } from "@/components/knowledge-base/logs-tab"
import { SettingsTab } from "@/components/knowledge-base/settings-tab"

type TabKey = "documents" | "testing" | "logs" | "settings"

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: "documents", label: "文件列表", icon: FileText },
  { key: "testing", label: "检索测试", icon: TextSearch },
  { key: "logs", label: "日志", icon: ScrollText },
  { key: "settings", label: "配置", icon: Settings },
]

export default function KnowledgeBaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>("documents")
  const [name, setName] = useState("")

  useEffect(() => {
    fetch(`/api/knowledge-base/datasets/${id}`)
      .then((r) => r.json())
      .then((d) => setName(d.dataset?.name ?? ""))
      .catch(() => {})
  }, [id])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/knowledge-base")}
          className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-semibold">{name || "知识库"}</h1>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-b-2 -mb-px",
                tab === t.key
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "documents" && <DocumentsTab datasetId={id} />}
      {tab === "testing" && <TestingTab datasetId={id} />}
      {tab === "logs" && <LogsTab datasetId={id} />}
      {tab === "settings" && <SettingsTab datasetId={id} />}
    </div>
  )
}
