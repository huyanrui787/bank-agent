"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

export type UserInfo = {
  id: string
  name: string
  role: string
  branch: string | null
  grid: string | null
  managerId: string | null
  roleName: string | null
  permissions: string[]
}

type UserState = {
  user: UserInfo | null
  loading: boolean
}

const UserContext = createContext<UserState>({ user: null, loading: true })

export function UserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserState>({ user: null, loading: true })

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("unauthenticated")
        return r.json()
      })
      .then((data: UserInfo) => setState({ user: { ...data, permissions: data.permissions ?? [] }, loading: false }))
      .catch(() => setState({ user: null, loading: false }))
  }, [])

  return <UserContext.Provider value={state}>{children}</UserContext.Provider>
}

export function useUser(): UserState {
  return useContext(UserContext)
}

export const ROLE_LABELS: Record<string, string> = {
  manager: "客户经理",
  sub_branch_head: "支行负责人",
  branch_admin: "分行管理员",
  compliance: "合规审计",
  readonly: "只读用户",
}
