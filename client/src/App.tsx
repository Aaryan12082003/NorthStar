import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { TaskFormDialog } from '@/components/task-form'
import { Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/providers/auth'
import { CalendarPage } from '@/pages/calendar'
import { DashboardPage } from '@/pages/dashboard'
import { LoginPage } from '@/pages/login'
import { MemberPage } from '@/pages/member'
import { NotificationsPage } from '@/pages/notifications'
import { ProjectPage } from '@/pages/project'
import { ProjectsPage } from '@/pages/projects'
import { ReportsPage } from '@/pages/reports'
import { SettingsPage } from '@/pages/settings'
import { TaskPage } from '@/pages/task'
import { TasksPage } from '@/pages/tasks'
import { TeamPage } from '@/pages/team'

export default function App() {
  const { user, loading } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F8FAFC]">
        <div className="w-64 space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="*"
        element={
          user ? (
            <AppShell onCreate={() => setCreateOpen(true)}>
              <Routes>
                <Route path="/" element={<DashboardPage onCreate={() => setCreateOpen(true)} />} />
                <Route path="/my-tasks" element={<TasksPage mine />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/tasks/:id" element={<TaskPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/team/:id" element={<MemberPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              {user.role !== 'EMPLOYEE' && <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />}
            </AppShell>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}
