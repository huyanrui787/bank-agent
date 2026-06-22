import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { UserProvider } from "@/lib/hooks/use-user"
import { TaskReminderProvider } from "@/components/tasks/task-reminder-provider"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <TaskReminderProvider>
        <div className="flex h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AppHeader />
            <main className="flex-1 overflow-y-auto scrollbar-thin bg-background">
              {children}
            </main>
          </div>
        </div>
      </TaskReminderProvider>
    </UserProvider>
  )
}
