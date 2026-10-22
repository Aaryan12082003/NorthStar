import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderKanban, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { usePage } from '@/components/layout'
import { AvatarStack, Card, EmptyState, ErrorState, ProjectStatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { Checkbox, Skeleton } from '@/components/ui/misc'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, ApiError } from '@/lib/api'
import { formatDay, projectStatusLabel, splitStamp, toStamp } from '@/lib/format'
import type { ProjectStatus } from '@/lib/types'
import { useAuth } from '@/providers/auth'

const colors = ['#2563EB', '#8B5CF6', '#16A34A', '#F59E0B', '#EF4444', '#0EA5E9']

const schema = z.object({
  name: z.string().trim().min(2, 'Name the project.').max(120),
  description: z.string().max(4000),
  ownerId: z.string().min(1, 'Choose an owner.'),
  memberIds: z.array(z.string()),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED']),
  startDate: z.string(),
  deadline: z.string(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
})

type Values = z.infer<typeof schema>

export function ProjectsPage() {
  const { user, workspace } = useAuth()
  usePage('Projects', [workspace?.name || 'Northstar', 'Projects'])
  const query = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const [open, setOpen] = useState(false)
  const canCreate = user?.role !== 'EMPLOYEE'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New project
          </Button>
        )}
      </div>
      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-48 rounded-2xl" />)}
        </div>
      ) : query.isError ? (
        <ErrorState message="Projects could not be loaded." onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState icon={<FolderKanban className="size-4" />} title="No projects yet" body="Create a project to group the work and the people on it." action={canCreate ? <Button onClick={() => setOpen(true)}>New project</Button> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="h-full p-5 transition hover:border-[#BFDBFE]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: project.color }} />
                    <h3 className="font-semibold text-[#0F172A]">{project.name}</h3>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm text-[#64748B]">{project.description || 'No description yet.'}</p>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-[#64748B]">
                    <span>{project.progress}% complete</span>
                    <span>{project.completedCount}/{project.taskCount} tasks</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <AvatarStack people={[project.owner, ...project.members.filter((member) => member.id !== project.owner.id)]} />
                  <span className={`text-xs ${project.overdueCount ? 'font-medium text-[#EF4444]' : 'text-[#94A3B8]'}`}>
                    {project.overdueCount ? `${project.overdueCount} overdue` : formatDay(project.deadline, user?.timezone || 'Asia/Kolkata')}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {canCreate && <ProjectDialog open={open} onOpenChange={setOpen} />}
    </div>
  )
}

export function ProjectDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (open: boolean) => void; projectId?: string }) {
  const { user } = useAuth()
  const client = useQueryClient()
  const members = useQuery({ queryKey: ['members'], queryFn: api.members, enabled: open })
  const existing = useQuery({ queryKey: ['project', projectId], queryFn: () => api.project(projectId!), enabled: open && Boolean(projectId) })
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: existing.data
      ? {
          name: existing.data.name,
          description: existing.data.description,
          ownerId: existing.data.owner.id,
          memberIds: existing.data.members.map((member) => member.id),
          status: existing.data.status,
          startDate: splitStamp(existing.data.startDate, user?.timezone || 'Asia/Kolkata').date,
          deadline: splitStamp(existing.data.deadline, user?.timezone || 'Asia/Kolkata').date,
          color: existing.data.color,
        }
      : {
          name: '',
          description: '',
          ownerId: user?.id || '',
          memberIds: user ? [user.id] : [],
          status: 'ACTIVE',
          startDate: '',
          deadline: '',
          color: colors[0],
        },
  })

  const submit = form.handleSubmit(async (values) => {
    const zone = user?.timezone || 'Asia/Kolkata'
    const body = {
      name: values.name,
      description: values.description,
      ownerId: values.ownerId,
      memberIds: Array.from(new Set([values.ownerId, ...values.memberIds])),
      status: values.status,
      color: values.color,
      startDate: values.startDate ? toStamp(values.startDate, '09:00', zone) : null,
      deadline: values.deadline ? toStamp(values.deadline, '18:00', zone) : null,
    }
    try {
      if (projectId) await api.updateProject(projectId, body)
      else await api.createProject(body)
      toast.success(projectId ? 'Project updated' : 'Project created')
      await client.invalidateQueries({ queryKey: ['projects'] })
      await client.invalidateQueries({ queryKey: ['project'] })
      onOpenChange(false)
      if (!projectId) form.reset()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The project could not be saved.')
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{projectId ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>Progress is calculated from completed tasks.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" {...form.register('name')} />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea id="project-description" {...form.register('description')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Owner</Label>
              <Select value={form.watch('ownerId')} onValueChange={(ownerId) => form.setValue('ownerId', ownerId, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Choose an owner" /></SelectTrigger>
                <SelectContent>
                  {members.data?.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.ownerId?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.watch('status')} onValueChange={(status) => form.setValue('status', status as ProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(projectStatusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-start">Start</Label>
              <Input id="project-start" type="date" {...form.register('startDate')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-end">Deadline</Label>
              <Input id="project-end" type="date" {...form.register('deadline')} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button key={color} type="button" className={`size-7 rounded-full ring-offset-2 ${form.watch('color') === color ? 'ring-2 ring-[#2563EB]' : ''}`} style={{ background: color }} onClick={() => form.setValue('color', color)} aria-label={color} />
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Team</Label>
            <div className="grid max-h-36 gap-2 overflow-auto rounded-xl border border-[#E2E8F0] p-3 sm:grid-cols-2">
              {members.data?.map((member) => {
                const selected = form.watch('memberIds').includes(member.id)
                return (
                  <label key={member.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) => {
                        const current = form.getValues('memberIds')
                        form.setValue('memberIds', checked ? [...current, member.id] : current.filter((id) => id !== member.id))
                      }}
                    />
                    {member.name}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>{projectId ? 'Save' : 'Create project'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
