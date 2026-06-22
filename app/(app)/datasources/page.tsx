"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, RefreshCw, Wifi, WifiOff, CheckCircle, XCircle, Loader2, Database } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { useUser } from "@/lib/hooks/use-user"
import { useRouter } from "next/navigation"

type DsType = "sqlite"|"mysql"|"postgresql"|"sqlserver"|"oracle"|"db2"|"hive"|"impala"|"elasticsearch"|"dtsql"|"vector_pgvector"|"vector_milvus"

type Datasource = {
  id: string; name: string; type: DsType
  host: string | null; port: number | null; databaseName: string | null
  username: string | null; hasPassword: boolean
  extraConfig: Record<string, string>
  enabled: boolean; createdAt: string
}

const TYPE_LABELS: Record<DsType, string> = {
  sqlite:          "SQLite",
  mysql:           "MySQL",
  postgresql:      "PostgreSQL",
  sqlserver:       "SQL Server",
  oracle:          "Oracle",
  db2:             "DB2",
  hive:            "Hive",
  impala:          "Impala",
  elasticsearch:   "Elasticsearch",
  dtsql:           "DTSQL（自建）",
  vector_pgvector: "pgvector（向量）",
  vector_milvus:   "Milvus（向量）",
}

const TYPE_COLORS: Record<DsType, string> = {
  sqlite: "bg-gray-100 text-gray-700",
  mysql: "bg-orange-50 text-orange-700",
  postgresql: "bg-blue-50 text-blue-700",
  sqlserver: "bg-red-50 text-red-700",
  oracle: "bg-red-50 text-red-800",
  db2: "bg-sky-50 text-sky-700",
  hive: "bg-yellow-50 text-yellow-700",
  impala: "bg-amber-50 text-amber-700",
  elasticsearch: "bg-green-50 text-green-700",
  dtsql: "bg-purple-50 text-purple-700",
  vector_pgvector: "bg-violet-50 text-violet-700",
  vector_milvus: "bg-indigo-50 text-indigo-700",
}

// ── Field definitions per type ────────────────────────────────────────────────

type FieldDef = { key: string; label: string; placeholder: string; type?: string; extra?: boolean }

function getFields(t: DsType): FieldDef[] {
  if (t === "sqlite") return [
    { key: "databaseName", label: "数据库文件路径", placeholder: "/path/to/database.db" },
  ]
  if (t === "elasticsearch") return [
    { key: "url", label: "连接地址", placeholder: "http://localhost:9200", extra: true },
    { key: "api_key", label: "API Key（可选）", placeholder: "base64_encoded_api_key", extra: true },
  ]
  if (t === "dtsql") return [
    { key: "url", label: "DTSQL 服务地址", placeholder: "http://your-server:8080", extra: true },
    { key: "token", label: "Token（可选）", placeholder: "Bearer token", extra: true },
  ]
  if (t === "vector_milvus") return [
    { key: "host", label: "主机", placeholder: "localhost" },
    { key: "port", label: "端口", placeholder: "19530", type: "number" },
    { key: "token", label: "Token（可选）", placeholder: "", extra: true },
  ]
  // SQL-based: mysql/postgresql/sqlserver/oracle/db2/hive/impala/vector_pgvector
  const defaults: FieldDef[] = [
    { key: "host", label: "主机地址", placeholder: "localhost" },
    { key: "port", label: "端口", placeholder: defaultPort(t), type: "number" },
    { key: "databaseName", label: "数据库名", placeholder: "database_name" },
    { key: "username", label: "用户名", placeholder: "username" },
    { key: "password", label: "密码", placeholder: "password", type: "password" },
  ]
  if (t === "oracle") defaults.push({ key: "service_name", label: "Service Name", placeholder: "ORCL", extra: true })
  if (t === "hive") defaults.push({ key: "auth", label: "认证方式", placeholder: "NONE / KERBEROS", extra: true })
  return defaults
}

function defaultPort(t: DsType): string {
  const ports: Partial<Record<DsType, string>> = {
    mysql: "3306", postgresql: "5432", sqlserver: "1433",
    oracle: "1521", db2: "50000", hive: "10000", impala: "21050",
    vector_pgvector: "5432",
  }
  return ports[t] ?? "5432"
}

// ── Form ──────────────────────────────────────────────────────────────────────

function DatasourceForm({ open, onOpenChange, initial, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void
  initial?: Datasource; onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<DsType>("mysql")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSavedId(initial?.id ?? null)
      setName(initial?.name ?? "")
      setType(initial?.type ?? "mysql")
      const f: Record<string, string> = {}
      if (initial) {
        if (initial.host) f.host = initial.host
        if (initial.port) f.port = String(initial.port)
        if (initial.databaseName) f.databaseName = initial.databaseName
        if (initial.username) f.username = initial.username
        if (initial.hasPassword) f.password = "••••••••"
        Object.entries(initial.extraConfig ?? {}).forEach(([k, v]) => { f[k] = String(v) })
      }
      setFields(f)
      setTestResult(null)
    }
  }, [open, initial])

  function setField(key: string, val: string) {
    setFields((p) => ({ ...p, [key]: val }))
  }

  function buildPayload() {
    const fieldDefs = getFields(type)
    const extra: Record<string, string> = {}
    const body: Record<string, unknown> = { name, type }
    for (const fd of fieldDefs) {
      const v = fields[fd.key] ?? ""
      if (!v || v === "••••••••") continue
      if (fd.extra) { extra[fd.key] = v; continue }
      if (fd.key === "host") body.host = v
      else if (fd.key === "port") body.port = Number(v)
      else if (fd.key === "databaseName") body.databaseName = v
      else if (fd.key === "username") body.username = v
      else if (fd.key === "password") body.password = v
    }
    if (Object.keys(extra).length) body.extraConfig = extra
    return body
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("请填写名称"); return }
    setSaving(true)
    try {
      const url = initial ? `/api/datasources/${initial.id}` : "/api/datasources"
      const method = initial ? "PUT" : "POST"
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "保存失败"); return }
      const data = await res.json()
      const id = initial?.id ?? data.id
      setSavedId(id)
      toast.success(initial ? "已更新" : "数据源已创建")
      onSaved()
    } finally { setSaving(false) }
  }

  async function handleTest() {
    const id = savedId
    if (!id) { toast.error("请先保存再测试"); return }
    setTesting(true); setTestResult(null)
    try {
      const res = await fetch(`/api/datasources/${id}/test`, { method: "POST" })
      const d = await res.json()
      setTestResult(d)
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "网络错误", latencyMs: 0 })
    } finally { setTesting(false) }
  }

  const fieldDefs = getFields(type)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{initial ? "编辑数据源" : "新建数据源"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">数据源名称 <span className="text-red-500">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：生产 MySQL" maxLength={60} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">数据库类型</label>
            <Select value={type} onValueChange={(v) => { setType(v as DsType); setFields({}) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(TYPE_LABELS) as [DsType, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fieldDefs.map((fd) => (
            <div key={fd.key} className="space-y-1.5">
              <label className="text-sm font-medium">{fd.label}</label>
              <Input
                type={fd.type ?? "text"}
                value={fields[fd.key] ?? ""}
                onChange={(e) => setField(fd.key, e.target.value)}
                placeholder={fd.placeholder}
              />
            </div>
          ))}

          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              <span>{testResult.message}{testResult.ok && testResult.latencyMs > 0 ? ` (${testResult.latencyMs}ms)` : ""}</span>
            </div>
          )}

          <Button variant="outline" size="sm" className="w-full" onClick={handleTest} disabled={testing || !savedId}>
            {testing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wifi className="h-4 w-4 mr-1.5" />}
            {testing ? "测试中…" : "测试连接"}
          </Button>
        </div>

        <SheetFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DatasourcesPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [datasources, setDatasources] = useState<Datasource[]>([])
  const [fetching, setFetching] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Datasource | undefined>()

  useEffect(() => {
    if (!loading && user && user.role !== "branch_admin") router.replace("/")
  }, [user, loading, router])

  const fetchDs = useCallback(async () => {
    setFetching(true)
    try {
      const res = await fetch("/api/datasources")
      if (!res.ok) return
      const d = await res.json()
      setDatasources(d.datasources ?? [])
    } finally { setFetching(false) }
  }, [])

  useEffect(() => { if (user?.role === "branch_admin") fetchDs() }, [user, fetchDs])

  async function toggleEnabled(ds: Datasource) {
    await fetch(`/api/datasources/${ds.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !ds.enabled }),
    })
    await fetchDs()
  }

  async function handleDelete(ds: Datasource) {
    if (!confirm(`确定删除「${ds.name}」？`)) return
    await fetch(`/api/datasources/${ds.id}`, { method: "DELETE" })
    toast.success("已删除")
    await fetchDs()
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>
  if (!user || user.role !== "branch_admin") return null

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">数据源管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            配置外部数据库连接，AI 分析引擎可跨数据源执行查询。支持 SQLite、MySQL、PostgreSQL、SQL Server、Oracle、DB2、Hive、Impala、Elasticsearch、DTSQL、pgvector、Milvus。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDs} disabled={fetching}>
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => { setEditing(undefined); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> 新建数据源
          </Button>
        </div>
      </div>

      {/* Type legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(TYPE_LABELS) as [DsType, string][]).map(([k, v]) => (
          <span key={k} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[k]}`}>{v}</span>
        ))}
      </div>

      {datasources.length === 0 ? (
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-3 text-muted-foreground">
            <Database className="h-10 w-10 opacity-30" />
            <p className="text-sm">还没有配置数据源</p>
            <Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setFormOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" /> 添加第一个数据源
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {datasources.map((ds) => (
            <Card key={ds.id} className={ds.enabled ? "" : "opacity-60"}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${ds.enabled ? "bg-primary/10" : "bg-muted"}`}>
                  {ds.enabled ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{ds.name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_COLORS[ds.type]}`}>
                      {TYPE_LABELS[ds.type]}
                    </span>
                    {ds.enabled
                      ? <Badge variant="success" className="text-[10px]">启用中</Badge>
                      : <Badge variant="muted" className="text-[10px]">已停用</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {ds.host ? `${ds.host}${ds.port ? ":" + ds.port : ""}` : ""}
                    {ds.databaseName ? ` / ${ds.databaseName}` : ""}
                    {ds.username ? ` · 用户：${ds.username}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleEnabled(ds)}
                    className="h-8 px-2 rounded text-xs border border-border hover:bg-accent">
                    {ds.enabled ? "停用" : "启用"}
                  </button>
                  <button onClick={() => { setEditing(ds); setFormOpen(true) }}
                    className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(ds)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DatasourceForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={fetchDs}
      />
    </div>
  )
}
