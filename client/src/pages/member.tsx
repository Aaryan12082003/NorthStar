import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { usePage } from '@/components/layout'
import { Avatar, Card, ErrorState, RoleBadge } from '@/components/common'
import { TaskTable } from '@/components/task-views'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import { relativeTime } from '@/lib/format'
import { useAuth } from '@/providers/auth'

export function MemberPage() {
  const { id = '' } = useParams()
  const { user, workspace } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['member', id], queryFn: () => api.member(id), enabled: Boolean(id) })
  usePage(query.data?.name || 'Profile', [workspace?.name || 'Northstar', 'Team', query.data?.name || 'Profile'])

  if (query.isLoading) return <Skeleton className="h-80 rounded-2xl" />
  if (query.isError || !query.data || !user) return <ErrorState message="This profile is unavailable." onRetry={() => query.refetch()} />

  const member = query.data
  const canRemove = user.role === 'ADMIN' && member.id !== user.id

  return (
    <div className="space-y-4">
      <Link to="/team" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]">
        <ArrowLeft className="size-4" /> Team
      </Link>
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={member.name} color={member.avatarColor} className="size-12 text-sm" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{member.name}</h2>
                <RoleBadge role={member.role} />
              </div>
              <p className="text-sm text-[#64748B]">{member.title} · {member.email}</p>
              <p className="text-xs text-[#94A3B8]">{member.timezone}</p>
            </div>
          </div>
          {canRemove && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await api.removeMember(member.id)
                  await client.invalidateQueries({ queryKey: ['members'] })
                  toast.success('Member removed')
                  navigate('/team')
                } catch (error) {
                  toast.error(error instanceof ApiError ? error.message : 'This person could not be removed.')
                }
              }}
            >
              Remove from workspace
            </Button>
          )}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Assigned" value={member.assigned} />
          <Stat label="Completed" value={member.completed} />
          <Stat label="Overdue" value={member.overdue} warn={member.overdue > 0} />
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold">Assigned tasks</h3>
          </div>
          {member.tasks?.length ? (
            <TaskTable tasks={member.tasks} timeZone={user.timezone} sort="deadline" dir="asc" onSort={() => undefined} />
          ) : (
            <p className="px-5 pb-5 text-sm text-[#64748B]">No tasks are assigned right now.</p>
          )}
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Recent activity</h3>
          <ul className="mt-3 space-y-3">
            {(member.activity || []).length === 0 && <li className="text-sm text-[#64748B]">No recent activity.</li>}
            {member.activity?.map((entry) => (
              <li key={entry.id} className="text-sm">
                <p className="text-[#0F172A]">{entry.message}</p>
                <p className="text-xs text-[#94A3B8]">{relativeTime(entry.createdAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] px-4 py-3">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${warn ? 'text-[#EF4444]' : 'text-[#0F172A]'}`}>{value}</p>
    </div>
  )
}
