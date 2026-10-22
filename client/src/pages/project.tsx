import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { usePage } from '@/components/layout'
import { Avatar, Card, ErrorState, ProjectStatusBadge } from '@/components/common'
import { TaskTable } from '@/components/task-views'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import { formatDay, relativeTime } from '@/lib/format'
import { ProjectDialog } from '@/pages/projects'
import { useAuth } from '@/providers/auth'

export function ProjectPage() {
  const { id = '' } = useParams()
  const { user, workspace } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const project = useQuery({ queryKey: ['project', id], queryFn: () => api.project(id), enabled: Boolean(id) })
  const tasks = useQuery({ queryKey: ['tasks', 'project', id], queryFn: () => api.tasks({ projectId: id, pageSize: 20, sort: 'deadline', dir: 'asc' }), enabled: Boolean(id) })
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  usePage(project.data?.name || 'Project', [workspace?.name || 'Northstar', 'Projects', project.data?.name || 'Project'])
  const canManage = user?.role !== 'EMPLOYEE'

  if (project.isLoading) return <Skeleton className="h-80 rounded-2xl" />
  if (project.isError || !project.data || !user) return <ErrorState message="This project is unavailable." onRetry={() => project.refetch()} />

  const item = project.data
  return (
    <div className="space-y-4">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]">
        <ArrowLeft className="size-4" /> Projects
      </Link>
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: item.color }} />
              <ProjectStatusBadge status={item.status} />
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">{item.name}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">{item.description || 'No description yet.'}</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              {user.role === 'ADMIN' && (
                <Button variant="ghost" aria-label="Delete project" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <Fact label="Progress" value={`${item.progress}%`} />
          <Fact label="Tasks" value={`${item.completedCount} of ${item.taskCount} done`} />
          <Fact label="Overdue" value={String(item.overdueCount)} />
          <Fact label="Deadline" value={formatDay(item.deadline, user.timezone)} />
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
          <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${item.progress}%` }} />
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold">Tasks</h3>
          </div>
          {tasks.isLoading ? <Skeleton className="m-5 h-40" /> : tasks.data?.items.length ? (
            <TaskTable tasks={tasks.data.items} timeZone={user.timezone} sort="deadline" dir="asc" onSort={() => undefined} />
          ) : (
            <p className="px-5 pb-5 text-sm text-[#64748B]">No tasks in this project yet.</p>
          )}
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold">People</h3>
            <ul className="mt-3 space-y-2">
              {[item.owner, ...item.members.filter((member) => member.id !== item.owner.id)].map((person) => (
                <li key={person.id}>
                  <Link to={`/team/${person.id}`} className="flex items-center gap-2 text-sm">
                    <Avatar name={person.name} color={person.avatarColor} className="size-7 text-[10px]" />
                    <span>
                      <span className="block text-[#0F172A]">{person.name}</span>
                      <span className="block text-xs text-[#64748B]">{person.id === item.owner.id ? 'Owner' : person.title}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <ul className="mt-3 space-y-3">
              {(item.activity || []).length === 0 && <li className="text-sm text-[#64748B]">Nothing recorded yet.</li>}
              {item.activity?.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <p className="text-[#0F172A]"><span className="font-medium">{entry.actor.name.split(' ')[0]}</span> {entry.message}</p>
                  <p className="text-xs text-[#94A3B8]">{relativeTime(entry.createdAt)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      {canManage && <ProjectDialog open={editing} onOpenChange={setEditing} projectId={item.id} />}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {item.name}?</DialogTitle>
            <DialogDescription>The project and its tasks will be removed from the workspace.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await api.deleteProject(item.id)
                  await client.invalidateQueries({ queryKey: ['projects'] })
                  toast.success('Project deleted')
                  navigate('/projects')
                } catch (error) {
                  toast.error(error instanceof ApiError ? error.message : 'The project could not be deleted.')
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[#94A3B8]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[#0F172A]">{value}</p>
    </div>
  )
}
