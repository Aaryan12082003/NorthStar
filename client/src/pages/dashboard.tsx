import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, ListTodo, LoaderCircle, Plus } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePage } from '@/components/layout'
import { Avatar, Card, EmptyState, ErrorState } from '@/components/common'
import { TaskTable } from '@/components/task-views'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { formatDay, greeting, relativeTime, statusLabel } from '@/lib/format'
import type { DashboardData, Priority, TaskStatus } from '@/lib/types'
import { useAuth } from '@/providers/auth'

const statusColor: Record<TaskStatus, string> = {
  TODO: '#94A3B8',
  IN_PROGRESS: '#2563EB',
  IN_REVIEW: '#8B5CF6',
  COMPLETED: '#16A34A',
  ARCHIVED: '#CBD5E1',
}

const priorityColor: Record<Priority, string> = {
  URGENT: '#EF4444',
  HIGH: '#F59E0B',
  MEDIUM: '#2563EB',
  LOW: '#94A3B8',
}

const tip = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  fontSize: 12,
  color: '#0F172A',
  boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
}

export function DashboardPage({ onCreate }: { onCreate: () => void }) {
  const { user, workspace } = useAuth()
  usePage('Dashboard', [workspace?.name || 'Northstar', 'Dashboard'])
  const query = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard })
  const canCreate = user?.role !== 'EMPLOYEE'

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError || !query.data || !user) {
    return <ErrorState message="The dashboard could not be loaded." onRetry={() => query.refetch()} />
  }

  const data = query.data

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#0F172A]">{greeting(user.name, user.timezone)}</h2>
          <p className="mt-1 text-sm text-[#64748B]">Here's what's happening with your team today.</p>
        </div>
        {canCreate && (
          <Button onClick={onCreate} size="lg">
            <Plus className="size-4" /> Create Task
          </Button>
        )}
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total tasks" value={data.stats.total.value} caption={data.stats.total.caption} tone={data.stats.total.tone} icon={<ListTodo className="size-4" />} />
        <StatCard title="Completed" value={data.stats.completed.value} caption={data.stats.completed.caption} tone={data.stats.completed.tone} icon={<CheckCircle2 className="size-4" />} />
        <StatCard title="In progress" value={data.stats.inProgress.value} caption={data.stats.inProgress.caption} tone={data.stats.inProgress.tone} icon={<LoaderCircle className="size-4" />} />
        <StatCard title="Overdue" value={data.stats.overdue.value} caption={data.stats.overdue.caption} tone={data.stats.overdue.tone} icon={<AlertCircle className="size-4" />} danger />
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <Card className="p-5 xl:col-span-3">
          <ChartTitle title="Tasks completed" hint="Last 14 days" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.completedOverTime.map((row) => ({ ...row, label: shortDay(row.date) }))}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} />
                <Area type="monotone" dataKey="count" name="Completed" stroke="#2563EB" fill="#EFF6FF" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5 xl:col-span-2">
          <ChartTitle title="By status" hint="Every task in view" />
          <StatusChart rows={data.byStatus} />
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <ChartTitle title="By priority" hint="Open and completed" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byPriority.map((row) => ({ ...row, label: row.priority[0] + row.priority.slice(1).toLowerCase() }))}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} />
                <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]} barSize={28}>
                  {data.byPriority.map((row) => (
                    <Cell key={row.priority} fill={priorityColor[row.priority]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <ChartTitle title="Employee workload" hint="Open tasks and estimated hours" />
          {data.workload.length === 0 ? (
            <p className="py-16 text-center text-sm text-[#64748B]">No open work is assigned yet.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.workload} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={64} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tip} formatter={(value, name) => [value, name === 'tasks' ? 'Open tasks' : 'Hours']} />
                  <Bar dataKey="tasks" name="tasks" fill="#2563EB" radius={[0, 6, 6, 0]} barSize={12} />
                  <Bar dataKey="hours" name="hours" fill="#BFDBFE" radius={[0, 6, 6, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <Card className="overflow-hidden xl:col-span-3">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold text-[#0F172A]">My upcoming tasks</h3>
            <span className="text-xs text-[#64748B]">Open work, soonest deadline first</span>
          </div>
          {data.upcoming.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState icon={<ListTodo className="size-4" />} title="Nothing due" body="Open tasks with a deadline will show up here." />
            </div>
          ) : (
            <TaskTable tasks={data.upcoming} timeZone={user.timezone} sort="deadline" dir="asc" onSort={() => undefined} />
          )}
        </Card>
        <Card className="p-5 xl:col-span-2">
          <h3 className="text-sm font-semibold text-[#0F172A]">Team activity</h3>
          <ActivityList activity={data.activity} />
        </Card>
      </section>
    </div>
  )
}

function StatCard({
  title,
  value,
  caption,
  tone,
  icon,
  danger,
}: {
  title: string
  value: number
  caption: string
  tone: 'good' | 'bad' | 'neutral'
  icon: ReactNode
  danger?: boolean
}) {
  const captionClass = tone === 'good' ? 'text-[#16A34A]' : tone === 'bad' ? 'text-[#EF4444]' : 'text-[#64748B]'
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-[#64748B]">{title}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${danger ? 'bg-[#FEF2F2] text-[#EF4444]' : 'bg-[#EFF6FF] text-[#2563EB]'}`}>{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A]">{value}</p>
      <p className={`mt-1 text-xs ${captionClass}`}>{caption}</p>
    </Card>
  )
}

function ChartTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h3 className="text-sm font-semibold text-[#0F172A]">{title}</h3>
      <span className="text-xs text-[#94A3B8]">{hint}</span>
    </div>
  )
}

function StatusChart({ rows }: { rows: DashboardData['byStatus'] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  if (total === 0) return <p className="py-16 text-center text-sm text-[#64748B]">No tasks yet.</p>
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="count" nameKey="status" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
              {rows.map((row) => (
                <Cell key={row.status} fill={statusColor[row.status]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tip} formatter={(value, _name, item) => [value, statusLabel[(item?.payload as { status: TaskStatus }).status]]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.status} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[#64748B]">
              <span className="size-2 rounded-full" style={{ background: statusColor[row.status] }} />
              {statusLabel[row.status]}
            </span>
            <span className="font-medium text-[#0F172A]">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActivityList({ activity }: { activity: DashboardData['activity'] }) {
  if (activity.length === 0) return <p className="py-10 text-sm text-[#64748B]">Recent changes will appear here.</p>
  return (
    <ul className="mt-4 space-y-4">
      {activity.map((item) => (
        <li key={item.id} className="flex gap-3">
          <Avatar name={item.actor.name} color={item.actor.avatarColor} className="size-8" />
          <div className="min-w-0">
            <p className="text-sm text-[#0F172A]">
              <span className="font-medium">{item.actor.name.split(' ')[0]}</span> {item.message}
            </p>
            <p className="text-xs text-[#94A3B8]">{relativeTime(item.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function shortDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return formatDay(new Date(Date.UTC(year, month - 1, day, 12)).toISOString(), 'UTC').replace(` ${year}`, '')
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}
