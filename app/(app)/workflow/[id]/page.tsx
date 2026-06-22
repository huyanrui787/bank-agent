"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

const WorkflowEditor = dynamic(() => import("@/components/workflow/workflow-editor"), { ssr: false })

export default function WorkflowEditorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-sm text-muted-foreground">加载画布中…</div>}>
      <WorkflowEditor />
    </Suspense>
  )
}
