import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { api, ApiError } from '@/lib/api'
import { priorityLabel, splitStamp, statusLabel, toStamp } from '@/lib/format'
import type { Priority, Task, TaskStatus } from '@/lib/types'
import { useAuth } from '@/providers/auth'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { FieldError, Input, Label, Textarea } from './ui/input'
import { Checkbox, Switch } from './ui/misc'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const schema = z.object({
  title: z.string().trim().min(2, 'Give the task a title.').max(160),
  description: z.string().max(8000),
  projectId: z.string().min(1, 'Choose a project.'),
  assigneeIds: z.array(z.string()).min(1, 'Assign at least one person.'),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED']),
  startDate: z.string(),
  deadlineDate: z.string().min(1, 'Add a deadline.'),
  deadlineTime: z.string().min(1, 'Add a time.'),
  estimatedHours: z.number().min(0, 'Hours cannot be negative.').max(1000),
  tags: z.array(z.string()),
  subtasks: z.array(z.string()),
  recurring: z.boolean(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  interval: z.number().int().min(1).max(30),
})

const empty = {
  title: '',
  description: '',
  projectId: '',
  assigneeIds: [] as string[],
  priority: 'MEDIUM' as Priority,
  status: 'TODO' as TaskStatus,
  startDate: '',
  deadlineDate: '',
  deadlineTime: '17:00',
  estimatedHours: 2,
  tags: [] as string[],
  subtasks: [] as string[],
  recurring: false,
  frequency: 'WEEKLY' as 'DAILY' | 'WEEKLY' | 'MONTHLY',
  interval: 1,
}

export function TaskFormDialog({ open, onOpenChange, task }: { open: boolean; onOpenChange: (open: boolean) => void; task?: Task | null }) {
  const { user } = useAuth()
  const client = useQueryClient()
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects, enabled: open })
  const members = useQuery({ queryKey: ['members'], queryFn: api.members, enabled: open })
  const [values, setValues] = useState(empty)
  const [tagInput, setTagInput] = useState('')
  const [subtaskInput, setSubtaskInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const timeZone = user?.timezone || 'Asia/Kolkata'

  const reset = () => {
    if (task) {
      const deadline = splitStamp(task.deadline, timeZone)
      const start = splitStamp(task.startDate, timeZone)
      setValues({
        title: task.title,
        description: task.description,
        projectId: task.project.id,
        assigneeIds: task.assignees.map((person) => person.id),
        priority: task.priority,
        status: task.status,
        startDate: start.date,
        deadlineDate: deadline.date,
        deadlineTime: deadline.time || '17:00',
        estimatedHours: task.estimatedHours,
        tags: task.tags.map((tag) => tag.name),
        subtasks: task.subtasks.map((item) => item.title),
        recurring: Boolean(task.recurrence),
        frequency: task.recurrence?.frequency || 'WEEKLY',
        interval: task.recurrence?.interval || 1,
      })
    } else {
      setValues({ ...empty, assigneeIds: user ? [user.id] : [] })
    }
    setErrors({})
    setTagInput('')
    setSubtaskInput('')
    setFiles([])
  }

  useEffect(() => {
    if (open) reset()
    // Reset the draft whenever the dialog opens or the task changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id])

  const submit = async () => {
    const parsed = schema.safeParse({ ...values, estimatedHours: Number(values.estimatedHours), interval: Number(values.interval) })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) next[issue.path.join('.')] = issue.message
      setErrors(next)
      return
    }
    const deadline = toStamp(parsed.data.deadlineDate, parsed.data.deadlineTime, timeZone)
    const startDate = parsed.data.startDate ? toStamp(parsed.data.startDate, '09:00', timeZone) : null
    if (startDate && new Date(startDate) > new Date(deadline)) {
      setErrors({ startDate: 'The start date needs to be on or before the deadline.' })
      return
    }
    const body = {
      title: parsed.data.title,
      description: parsed.data.description,
      projectId: parsed.data.projectId,
      assigneeIds: parsed.data.assigneeIds,
      priority: parsed.data.priority,
      status: parsed.data.status,
      startDate,
      deadline,
      estimatedHours: parsed.data.estimatedHours,
      tags: parsed.data.tags,
      subtasks: parsed.data.subtasks.filter(Boolean).map((title) => ({ title, done: false })),
      recurrence: parsed.data.recurring ? { frequency: parsed.data.frequency, interval: parsed.data.interval } : null,
    }
    setSaving(true)
    try {
      const saved = task ? await api.updateTask(task.id, body) : await api.createTask(body)
      for (const file of files) await api.upload(saved.id, file)
      toast.success(task ? 'Task updated' : 'Task created')
      await client.invalidateQueries({ queryKey: ['tasks'] })
      await client.invalidateQueries({ queryKey: ['task'] })
      await client.invalidateQueries({ queryKey: ['dashboard'] })
      await client.invalidateQueries({ queryKey: ['projects'] })
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
        const next: Record<string, string> = {}
        for (const issue of error.issues) next[issue.path] = issue.message
        setErrors(next)
      } else toast.error('The task could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit task' : 'Create task'}</DialogTitle>
          <DialogDescription>Add the context, the owner, and the moment it needs to be done.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} placeholder="What needs to happen?" />
            <FieldError message={errors.title} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="Decisions, links, and what done looks like." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Project</Label>
              <Select value={values.projectId} onValueChange={(projectId) => setValues({ ...values, projectId })}>
                <SelectTrigger><SelectValue placeholder="Choose a project" /></SelectTrigger>
                <SelectContent>
                  {projects.data?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.projectId} />
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={values.priority} onValueChange={(priority) => setValues({ ...values, priority: priority as Priority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={values.status} onValueChange={(status) => setValues({ ...values, status: status as TaskStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="hours">Estimated hours</Label>
              <Input id="hours" type="number" min={0} step="0.5" value={values.estimatedHours} onChange={(event) => setValues({ ...values, estimatedHours: Number(event.target.value) })} />
              <FieldError message={errors.estimatedHours} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="start">Start date</Label>
              <Input id="start" type="date" value={values.startDate} onChange={(event) => setValues({ ...values, startDate: event.target.value })} />
              <FieldError message={errors.startDate} />
            </div>
            <div className="grid gap-1.5">
              <Label>Deadline</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={values.deadlineDate} onChange={(event) => setValues({ ...values, deadlineDate: event.target.value })} />
                <Input type="time" value={values.deadlineTime} onChange={(event) => setValues({ ...values, deadlineTime: event.target.value })} />
              </div>
              <FieldError message={errors.deadlineDate || errors.deadlineTime || errors.deadline} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Assignees</Label>
            <div className="grid max-h-36 gap-2 overflow-auto rounded-xl border border-[#E2E8F0] p-3 sm:grid-cols-2">
              {members.data?.map((member) => (
                <label key={member.id} className="flex items-center gap-2 text-sm text-[#0F172A]">
                  <Checkbox
                    checked={values.assigneeIds.includes(member.id)}
                    onCheckedChange={(checked) =>
                      setValues({
                        ...values,
                        assigneeIds: checked ? [...values.assigneeIds, member.id] : values.assigneeIds.filter((id) => id !== member.id),
                      })
                    }
                  />
                  <span>{member.name}</span>
                  <span className="text-xs text-[#64748B]">{member.title}</span>
                </label>
              ))}
            </div>
            <FieldError message={errors.assigneeIds} />
          </div>
          <div className="grid gap-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {values.tags.map((tag) => (
                <button key={tag} type="button" className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs text-[#1D4ED8]" onClick={() => setValues({ ...values, tags: values.tags.filter((item) => item !== tag) })}>
                  {tag} ×
                </button>
              ))}
            </div>
            <Input
              value={tagInput}
              placeholder="Type a tag and press Enter"
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const tag = tagInput.trim()
                  if (tag && !values.tags.includes(tag)) setValues({ ...values, tags: [...values.tags, tag] })
                  setTagInput('')
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Checklist</Label>
            {values.subtasks.map((item, index) => (
              <div key={`${item}-${index}`} className="flex items-center gap-2">
                <Input value={item} onChange={(event) => setValues({ ...values, subtasks: values.subtasks.map((entry, itemIndex) => (itemIndex === index ? event.target.value : entry)) })} />
                <Button type="button" variant="ghost" onClick={() => setValues({ ...values, subtasks: values.subtasks.filter((_, itemIndex) => itemIndex !== index) })}>Remove</Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={subtaskInput} placeholder="Add a subtask" onChange={(event) => setSubtaskInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  if (subtaskInput.trim()) setValues({ ...values, subtasks: [...values.subtasks, subtaskInput.trim()] })
                  setSubtaskInput('')
                }
              }} />
              <Button type="button" variant="outline" onClick={() => {
                if (subtaskInput.trim()) setValues({ ...values, subtasks: [...values.subtasks, subtaskInput.trim()] })
                setSubtaskInput('')
              }}>Add</Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="attachments">Attachments</Label>
            <Input
              id="attachments"
              type="file"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
            />
            {files.length > 0 && <p className="text-xs text-[#64748B]">{files.map((file) => file.name).join(', ')}</p>}
            <p className="text-xs text-[#94A3B8]">Images, PDFs, and documents. 8 MB each.</p>
          </div>
          {!task && (
            <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-[#0F172A]">Recurring task</p>
                <p className="text-xs text-[#64748B]">Create the next occurrence automatically.</p>
              </div>
              <Switch checked={values.recurring} onCheckedChange={(recurring) => setValues({ ...values, recurring })} />
            </div>
          )}
          {values.recurring && !task && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={values.frequency} onValueChange={(frequency) => setValues({ ...values, frequency: frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" min={1} max={30} value={values.interval} onChange={(event) => setValues({ ...values, interval: Number(event.target.value) })} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
