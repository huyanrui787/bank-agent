"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, RefreshCw, ShieldCheck, UserRound, Users } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useUser } from "@/lib/hooks/use-user"

type ActionDef = { label: string; group: string }
type Role = {
  code: string
  name: string
  data_scope: "personal" | "branch" | "bank"
  builtin: boolean
  mask_pii: boolean
  description: string
  permissions: string[]
}
type UserRec = {
  id: string
  username: string
  display_name: string
  role: string
  role_name: string | null
  branch: string | null
  grid: string | null
  manager_id: string | null
  enabled: boolean
  last_login_at: string | null
  created_at: string
}

const GROUP_ORDER = ["数据查看", "业务操作", "系统管理"]

function groupActions(actions: Record<string, ActionDef>) {
  return GROUP_ORDER.map((group) => ({
    group,
    items: Object.entries(actions).filter(([, def]) => def.group === group),
  })).filter((g) => g.items.length > 0)
}

// ── 账户管理 ──────────────────────────────────────────────────────────────────

function UserForm({
  open, onOpenChange, initial, roles, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  initial?: UserRec; roles: Role[]; onSaved: () => void
}) {
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("")
  const [branch, setBranch] = useState("")
  const [grid, setGrid] = useState("")
  const [managerId, setManagerId] = useState("")
  const [saving, setSaving] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)

  if (open && !wasOpen) {
    setWasOpen(true)
    setUsername(initial?.username ?? "")
    setDisplayName(initial?.display_name ?? "")
    setPassword("")
    setRole(initial?.role ?? roles[0]?.code ?? "")
    setBranch(initial?.branch ?? "")
    setGrid(initial?.grid ?? "")
    setManagerId(initial?.manager_id ?? "")
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  async function handleSave() {
    if (!displayName.trim()) { toast.error("请填写姓名"); return }
    if (!initial && !username.trim()) { toast.error("请填写用户名"); return }
    if (!initial && password.length < 6) { toast.error("密码至少 6 位"); return }
    if (!role) { toast.error("请选择角色"); return }

    setSaving(true)
    try {
      const url = initial ? `/api/users/${initial.id}` : "/api/users"
      const method = initial ? "PUT" : "POST"
      const body: Record<string, unknown> = {
        display_name: displayName.trim(),
        role,
        branch: branch.trim() || null,
        grid: grid.trim() || null,
        manager_id: managerId.trim() || null,
      }
      if (initial) {
        if (password) body.password = password
      } else {
        body.username = username.trim()
        body.password = password
      }
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? "保存失败"); return
      }
      toast.success(initial ? "已更新" : "账户已创建")
      onSaved(); onOpenChange(false)
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{initial ? "编辑账户" : "新建账户"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">用户名 <span className="text-red-500">*</span></label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={!!initial} placeholder="登录账号，如 zhangming" maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">姓名 <span className="text-red-500">*</span></label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="如 张明" maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{initial ? "重置密码（留空则不修改）" : "密码"}{initial ? "" : <span className="text-red-500"> *</span>}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={initial ? "留空不修改" : "至少 6 位"} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">角色 <span className="text-red-500">*</span></label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">所属支行</label>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="如 高新支行" maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">网格</label>
            <Input value={grid} onChange={(e) => setGrid(e.target.value)} placeholder="如 高新一网格" maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">客户经理编号（可选）</label>
            <Input value={managerId} onChange={(e) => setManagerId(e.target.value)} placeholder="如 M001" maxLength={60} />
          </div>
        </div>

        <SheetFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function UsersTab({ roles }: { roles: Role[] }) {
  const [users, setUsers] = useState<UserRec[]>([])
  const [fetching, setFetching] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UserRec | undefined>()

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users")
      if (!res.ok) return
      const d = await res.json()
      setUsers(d.users ?? [])
    } finally { setFetching(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function toggleEnabled(u: UserRec) {
    await fetch(`/api/users/${u.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !u.enabled }),
    })
    await fetchUsers()
  }

  async function handleDelete(u: UserRec) {
    if (!confirm(`确定删除账户「${u.display_name}」？`)) return
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "删除失败"); return }
    toast.success("已删除"); await fetchUsers()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">管理登录账户、所属角色与机构归属。</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={fetching}>
            <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => { setEditing(undefined); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> 新建账户
          </Button>
        </div>
      </div>

      {users.map((u) => (
        <Card key={u.id} className={u.enabled ? "" : "opacity-60"}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UserRound className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{u.display_name}</span>
                <span className="text-xs text-muted-foreground">@{u.username}</span>
                {u.role_name && <Badge variant="default" className="text-[10px]">{u.role_name}</Badge>}
                {u.enabled ? <Badge variant="success" className="text-[10px]">启用中</Badge> : <Badge variant="muted" className="text-[10px]">已停用</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[u.branch, u.grid].filter(Boolean).join(" · ") || "未分配机构"}
                {u.last_login_at ? ` · 最近登录 ${u.last_login_at.slice(0, 10)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => toggleEnabled(u)}
                className="h-8 px-2 rounded text-xs border border-border hover:bg-accent transition-colors">
                {u.enabled ? "停用" : "启用"}
              </button>
              <button onClick={() => { setEditing(u); setFormOpen(true) }}
                className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(u)}
                className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardContent>
        </Card>
      ))}

      <UserForm open={formOpen} onOpenChange={setFormOpen} initial={editing} roles={roles} onSaved={fetchUsers} />
    </div>
  )
}

// ── 角色与权限 ────────────────────────────────────────────────────────────────

function RoleForm({
  open, onOpenChange, actions, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  actions: Record<string, ActionDef>; onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [dataScope, setDataScope] = useState<"personal" | "branch" | "bank">("bank")
  const [maskPii, setMaskPii] = useState(false)
  const [description, setDescription] = useState("")
  const [perms, setPerms] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)

  if (open && !wasOpen) {
    setWasOpen(true)
    setName(""); setDataScope("bank"); setMaskPii(false); setDescription(""); setPerms(new Set())
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  function toggle(a: string) {
    setPerms((prev) => {
      const n = new Set(prev)
      if (n.has(a)) n.delete(a); else n.add(a)
      return n
    })
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("请填写角色名称"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/roles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), dataScope, maskPii, description: description.trim(), permissions: [...perms] }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "保存失败"); return }
      toast.success("角色已创建")
      onSaved(); onOpenChange(false)
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader><SheetTitle>新建角色</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">角色名称 <span className="text-red-500">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 数据分析员" maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">数据范围</label>
            <Select value={dataScope} onValueChange={(v) => setDataScope(v as "personal" | "branch" | "bank")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">本人数据</SelectItem>
                <SelectItem value="branch">本支行数据</SelectItem>
                <SelectItem value="bank">全行数据</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={maskPii} onCheckedChange={(v) => setMaskPii(v === true)} />
            <span>脱敏查看客户数据（PII 二次脱敏）</span>
          </label>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">描述</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" maxLength={200} />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">功能权限</label>
            {groupActions(actions).map((g) => (
              <div key={g.group} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{g.group}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {g.items.map(([a, def]) => (
                    <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={perms.has(a)} onCheckedChange={() => toggle(a)} />
                      <span>{def.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <SheetFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function RoleCard({ role, actions, onChanged }: { role: Role; actions: Record<string, ActionDef>; onChanged: () => void }) {
  const [dataScope, setDataScope] = useState(role.data_scope)
  const [maskPii, setMaskPii] = useState(role.mask_pii)
  const [perms, setPerms] = useState<Set<string>>(new Set(role.permissions))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  function toggle(a: string) {
    setPerms((prev) => {
      const n = new Set(prev)
      if (n.has(a)) n.delete(a); else n.add(a)
      return n
    })
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/roles/${role.code}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataScope, maskPii, permissions: [...perms] }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "保存失败"); return }
      toast.success(`「${role.name}」已保存`)
      setDirty(false)
      onChanged()
    } finally { setSaving(false) }
  }

  async function del() {
    if (!confirm(`确定删除角色「${role.name}」？`)) return
    const res = await fetch(`/api/roles/${role.code}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error ?? "删除失败"); return }
    toast.success("已删除"); onChanged()
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{role.name}</span>
          <span className="text-xs text-muted-foreground font-mono">{role.code}</span>
          {role.builtin && <Badge variant="outline" className="text-[10px]">内置</Badge>}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">数据范围</span>
            <Select value={dataScope} onValueChange={(v) => { setDataScope(v as "personal" | "branch" | "bank"); setDirty(true) }}>
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">本人数据</SelectItem>
                <SelectItem value="branch">本支行数据</SelectItem>
                <SelectItem value="bank">全行数据</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" title="PII 二次脱敏">
              <Checkbox checked={maskPii} onCheckedChange={(v) => { setMaskPii(v === true); setDirty(true) }} />
              <span>脱敏</span>
            </label>
            <Button size="sm" variant={dirty ? "default" : "outline"} onClick={save} disabled={saving || !dirty}>
              {saving ? "保存中…" : "保存"}
            </Button>
            {!role.builtin && (
              <button onClick={del} className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {groupActions(actions).map((g) => (
            <div key={g.group} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{g.group}</p>
              {g.items.map(([a, def]) => (
                <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={perms.has(a)} onCheckedChange={() => toggle(a)} />
                  <span>{def.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RolesTab({ roles, actions, onChanged }: { roles: Role[]; actions: Record<string, ActionDef>; onChanged: () => void }) {
  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">配置每个角色的功能权限与数据范围。内置角色不可删除。</p>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> 新建角色
        </Button>
      </div>
      {roles.map((r) => <RoleCard key={r.code} role={r} actions={actions} onChanged={onChanged} />)}
      <RoleForm open={formOpen} onOpenChange={setFormOpen} actions={actions} onSaved={onChanged} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [roles, setRoles] = useState<Role[]>([])
  const [actions, setActions] = useState<Record<string, ActionDef>>({})

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles")
      if (!res.ok) return
      const d = await res.json()
      setRoles(d.roles ?? [])
      setActions(d.actions ?? {})
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!loading && user && !user.permissions?.includes("manage_users")) router.replace("/")
  }, [user, loading, router])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 登录后拉取角色权限目录供页面渲染 */
    if (user?.permissions?.includes("manage_users")) fetchRoles()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user, fetchRoles])

  if (loading) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>
  if (!user || !user.permissions?.includes("manage_users")) return null

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">权限配置</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理账户、角色、功能权限与数据范围。</p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1.5" />账户管理</TabsTrigger>
          <TabsTrigger value="roles"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />角色与权限</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab roles={roles} /></TabsContent>
        <TabsContent value="roles"><RolesTab roles={roles} actions={actions} onChanged={fetchRoles} /></TabsContent>
      </Tabs>
    </div>
  )
}
