"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { ChatMessageList } from "@/components/chat/chat-message-list"
import { ChatInput } from "@/components/chat/chat-input"
import { DatasourceTableSelector, type DatasourceOption } from "@/components/chat/datasource-table-selector"
import type { TableSchema } from "@/lib/db/schema-info"
import type { ChatMessage, Conversation, ConversationListItem } from "@/lib/agent/chat-types"
import type { StreamEvent } from "@/lib/agent/types"
import { readSse } from "@/lib/agent/sse"
import {
  loadConversationList,
  loadConversation,
  saveConversation,
  deleteConversation,
  createConversation,
} from "@/lib/agent/chat-store"
import { getLoadedSkillIds, toggleSkill, getSkillPromptOverride, BUILTIN_SKILLS } from "@/lib/agent/skill-store"
import { randomId } from "@/lib/utils"

export default function DashboardPage() {
  const [convList, setConvList] = useState<ConversationListItem[]>([])
  const [currentConv, setCurrentConv] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [loadedSkillIds, setLoadedSkillIds] = useState<string[]>([])
  // 内置技能先占位，拉到 /api/skills 后替换为「内置 + 自定义」，避免标签闪空
  const [skills, setSkills] = useState<{ id: string; name: string }[]>(BUILTIN_SKILLS)
  const abortRef = useRef<AbortController | null>(null)

  // ── 数据源 + 选表（NL2SQL：让 AI 自主/手动匹配库表） ───────────────────────
  const [datasources, setDatasources] = useState<DatasourceOption[]>([])
  const [selectedDsId, setSelectedDsId] = useState<string | null>(null)
  const [tables, setTables] = useState<TableSchema[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(false)

  const loadSchema = useCallback(async (dsId: string | null) => {
    setSchemaLoading(true)
    setSelectedTable(null)
    try {
      const url = dsId ? `/api/datasources/${dsId}/schema` : "/api/schema"
      const res = await fetch(url)
      if (!res.ok) { setTables([]); return }
      const d = await res.json()
      setTables(d.tables ?? [])
    } catch { setTables([]) }
    finally { setSchemaLoading(false) }
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 客户端挂载后一次性水合 localStorage 会话（SSR 由 mounted 门控） */
    const list = loadConversationList()
    setConvList(list)
    if (list.length > 0) {
      setCurrentConv(loadConversation(list[0].id))
    } else {
      const conv = createConversation()
      saveConversation(conv)
      setConvList([{ id: conv.id, title: conv.title, updatedAt: conv.updatedAt }])
      setCurrentConv(conv)
    }
    setLoadedSkillIds(getLoadedSkillIds())
    setMounted(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // 拉取数据源列表（默认库 + 已配置的数据源）
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/datasources")
        if (!res.ok) return
        const d = await res.json()
        setDatasources([
          { id: null, name: "默认客户库（bank.db）", type: "sqlite" },
          ...((d.datasources ?? []) as { id: string; name: string; type: string }[])
            .map((ds) => ({ id: ds.id, name: ds.name, type: ds.type })),
        ])
      } catch { /* ignore */ }
    })()
  }, [])

  // 拉取技能列表（内置 + 自定义），供已挂载技能标签渲染名称
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/skills")
        if (!res.ok) return
        const d = await res.json()
        const list = (d.skills ?? []) as { id: string; name: string }[]
        if (list.length) setSkills(list.map((s) => ({ id: s.id, name: s.name })))
      } catch { /* 保留内置技能占位 */ }
    })()
  }, [])

  // 数据源变化时加载其表结构（首帧即拉默认库，故同步触发 loading/重置选中表）
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 数据源切换需同步重置选中表并置 loading，属外部数据同步而非派生状态 */
    loadSchema(selectedDsId)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedDsId, loadSchema])

  const handleUnloadSkill = useCallback((id: string) => {
    setLoadedSkillIds(toggleSkill(id))
  }, [])

  const handleSelect = useCallback((id: string) => {
    const conv = loadConversation(id)
    if (conv) setCurrentConv(conv)
  }, [])

  const handleCreate = useCallback(() => {
    const conv = createConversation()
    saveConversation(conv)
    setConvList(loadConversationList())
    setCurrentConv(conv)
  }, [])

  const handleDelete = useCallback((id: string) => {
    deleteConversation(id)
    const list = loadConversationList()
    setConvList(list)
    if (currentConv?.id === id) {
      if (list.length > 0) {
        setCurrentConv(loadConversation(list[0].id))
      } else {
        const conv = createConversation()
        saveConversation(conv)
        setConvList(loadConversationList())
        setCurrentConv(conv)
      }
    }
  }, [currentConv?.id])

  const handleSend = useCallback(async (text: string) => {
    if (!currentConv) return

    // abort any in-flight request
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    const userMsg: ChatMessage = {
      id: randomId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    }
    const assistantId = randomId()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      steps: [],
    }

    const withUser: Conversation = {
      ...currentConv,
      messages: [...currentConv.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
      title: currentConv.messages.length === 0 ? text.slice(0, 20) : currentConv.title,
    }
    setCurrentConv(withUser)
    saveConversation(withUser)
    setConvList(loadConversationList())
    setLoading(true)
    setStreamingId(assistantId)

    // mutable snapshot to avoid stale closure
    let live = withUser

    const patch = (updater: (m: ChatMessage) => ChatMessage) => {
      live = {
        ...live,
        messages: live.messages.map((m) => m.id === assistantId ? updater(m) : m),
        updatedAt: Date.now(),
      }
      setCurrentConv({ ...live })
    }

    try {
      const res = await fetch("/api/mock-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          skillIds: getLoadedSkillIds(),
          // Send client-side overridden prompts for builtin skills
          skillOverrides: Object.fromEntries(
            BUILTIN_SKILLS
              .map((s) => [s.id, getSkillPromptOverride(s.id)])
              .filter(([, v]) => v !== null)
          ),
          datasourceId: selectedDsId ?? undefined,
          selectedTable: selectedTable ?? undefined,
        }),
        signal: ac.signal,
      })

      if (!res.body) throw new Error("no body")

      for await (const raw of readSse(res.body)) {
        const event = raw as StreamEvent
        if (event.type === "step") {
          patch((m) => ({ ...m, steps: [...(m.steps ?? []), event.step] }))
        } else if (event.type === "text_delta") {
          patch((m) => ({ ...m, content: m.content + event.delta }))
        } else if (event.type === "done") {
          const resp = event.response
          patch((m) => ({ ...m, content: resp.summary, steps: resp.steps, response: resp }))
          saveConversation(live)
          setConvList(loadConversationList())
        } else if (event.type === "error") {
          patch((m) => ({ ...m, content: `错误：${event.message}` }))
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        patch((m) => ({ ...m, content: "请求失败，请重试。" }))
      }
    } finally {
      setStreamingId(null)
      setLoading(false)
    }
  }, [currentConv, selectedDsId, selectedTable])

  if (!mounted) return null

  return (
    <div className="flex h-full">
      <ChatSidebar
        conversations={convList}
        currentId={currentConv?.id ?? null}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatMessageList
          messages={currentConv?.messages ?? []}
          loading={false}
          streamingId={streamingId}
          onSendAction={handleSend}
        />
        <DatasourceTableSelector
          datasources={datasources}
          selectedDsId={selectedDsId}
          onSelectDs={setSelectedDsId}
          tables={tables}
          selectedTable={selectedTable}
          onSelectTable={setSelectedTable}
          loading={schemaLoading}
        />
        <ChatInput
          onSend={handleSend}
          loading={loading}
          loadedSkillIds={loadedSkillIds}
          skills={skills}
          onUnloadSkill={handleUnloadSkill}
        />
      </div>
    </div>
  )
}
