import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, Paperclip, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { usePage } from '@/components/layout'
import { Avatar, Card, ErrorState, PriorityBadge, StatusBadge } from '@/components/common'
import { TaskFormDialog } from '@/components/task-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldError, Input, Textarea } from '@/components/ui/input'
import { Checkbox, Skeleton } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import { fileSize, formatWhen, relativeTime, statusLabel } from '@/lib/format'
import type { Task } from '@/lib/types'
import { allowedMoves } from '@/lib/workflow'
import { useAuth } from '@/providers/auth'

export function TaskPage() {
  const { id = '' } = useParams()
  const { user, workspace } = useAuth()
  const navigate = useNavigate()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['task', id], queryFn: () => api.task(id), enabled: Boolean(id) })
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [comment, setComment] = useState('')
  const [note, setNote] = useState('')
  const [commentError, setCommentError] = useState('')
  usePage(query.data?.title || 'Task', [workspace?.name || 'Northstar', 'Tasks', query.data?.title || 'Task'])

  const refresh = async (task?: Task) => {
    if (task) client.setQueryData(['task', id], task)
    await client.invalidateQueries({ queryKey: ['tasks'] })
    await client.invalidateQueries({ queryKey: ['dashboard'] })
    await client.invalidateQueries({ queryKey: ['task', id] })
  }

  const run = async (action: () => Promise<Task | void>, success: string) => {
    try {
      const task = await action()
      if (task) await refresh(task)
      else await refresh()
      toast.success(success)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That action did not complete.')
    }
  }

  if (query.isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (query.isError || !query.data || !user) return <ErrorState message="This task is unavailable." onRetry={() => query.refetch()} />

  const task = query.data
  const canManage = user.role !== 'EMPLOYEE'
  const moves = allowedMoves(user.role, task.status)
  const done = task.subtasks.filter((item) => item.done).length

  return (
    <div className="space-y-4">
      <Link to="/tasks" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]">
        <ArrowLeft className="size-4" /> All tasks
      </Link>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} />
                  {task.overdue && <span className="text-xs font-medium text-[#EF4444]">Overdue</span>}
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#0F172A]">{task.title}</h2>
                <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[#64748B]">{task.description || 'No description yet.'}</p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete task"><Trash2 className="size-4" /></Button>
                </div>
              )}
            </div>
            {task.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {task.tags.map((tag) => (
                  <span key={tag.id} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: `${tag.color}16`, color: tag.color }}>{tag.name}</span>
                ))}
              </div>
            )}
            {moves.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#64748B]">Move to</span>
                {moves.map((status) => (
                  <Button key={status} size="sm" variant="soft" onClick={() => run(() => api.transition(task.id, status), `Moved to ${statusLabel[status]}`)}>
                    {statusLabel[status]}
                  </Button>
                ))}
              </div>
            )}
            {canManage && task.status === 'IN_REVIEW' && (
              <div className="mt-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-sm font-medium text-[#0F172A]">Review</p>
                <p className="mt-1 text-xs text-[#64748B]">Approve the work, or send it back with a note.</p>
                <Textarea className="mt-3 min-h-20 bg-white" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for the assignee" />
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => run(() => api.review(task.id, 'approve', note), 'Task approved')}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => run(() => api.review(task.id, 'return', note), 'Returned for changes')}>Return</Button>
                </div>
              </div>
            )}
            {task.reviewNote && (
              <p className="mt-4 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm text-[#64748B]">
                Review note{task.reviewedBy ? ` from ${task.reviewedBy.name}` : ''}: {task.reviewNote}
              </p>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0F172A]">Checklist</h3>
              <span className="text-xs text-[#64748B]">{done}/{task.subtasks.length}</span>
            </div>
            {task.subtasks.length === 0 ? (
              <p className="mt-3 text-sm text-[#64748B]">No subtasks yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {task.subtasks.map((item) => (
                  <li key={item.id}>
                    <label className="flex items-center gap-2 text-sm text-[#0F172A]">
                      <Checkbox checked={item.done} onCheckedChange={(checked) => run(() => api.subtask(item.id, Boolean(checked)), item.done ? 'Marked open' : 'Marked done')} />
                      <span className={item.done ? 'text-[#94A3B8] line-through' : ''}>{item.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-sm font-semibold text-[#0F172A]">Comments</h3>
            <ul className="mt-4 space-y-4">
              {task.comments.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <Avatar name={item.author.name} color={item.author.avatarColor} />
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{item.author.name} <span className="font-normal text-[#94A3B8]">{relativeTime(item.createdAt)}</span></p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <form
              className="mt-4 grid gap-2"
              onSubmit={async (event) => {
                event.preventDefault()
                if (!comment.trim()) {
                  setCommentError('Write a comment.')
                  return
                }
                setCommentError('')
                await run(async () => {
                  const next = await api.comment(task.id, comment.trim())
                  setComment('')
                  return next
                }, 'Comment added')
              }}
            >
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Leave a note for the people on this task" />
              <FieldError message={commentError} />
              <div className="flex justify-end">
                <Button type="submit" size="sm">Comment</Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4 p-5 text-sm">
            <Meta label="Project" value={<Link className="font-medium text-[#2563EB]" to={`/projects/${task.project.id}`}>{task.project.name}</Link>} />
            <Meta label="Deadline" value={<span className={task.overdue ? 'font-medium text-[#EF4444]' : ''}>{formatWhen(task.deadline, user.timezone)}</span>} />
            <Meta label="Start" value={formatWhen(task.startDate, user.timezone)} />
            <Meta label="Estimate" value={`${task.estimatedHours} h`} />
            <Meta label="Created by" value={task.createdBy.name} />
            {task.recurrence && <Meta label="Repeats" value={`Every ${task.recurrence.interval} ${task.recurrence.frequency.toLowerCase()}`} />}
            <div>
              <p className="text-xs text-[#94A3B8]">Assignees</p>
              <ul className="mt-2 space-y-2">
                {task.assignees.map((person) => (
                  <li key={person.id}>
                    <Link to={`/team/${person.id}`} className="flex items-center gap-2 hover:text-[#2563EB]">
                      <Avatar name={person.name} color={person.avatarColor} className="size-7 text-[10px]" />
                      <span>
                        <span className="block text-sm text-[#0F172A]">{person.name}</span>
                        <span className="block text-xs text-[#64748B]">{person.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0F172A]">Attachments</h3>
              <label className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-[#2563EB]">
                <Paperclip className="size-3.5" /> Add
                <Input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    void run(() => api.upload(task.id, file), 'File uploaded')
                  }}
                />
              </label>
            </div>
            {task.attachments.length === 0 ? (
              <p className="mt-3 text-sm text-[#64748B]">Images, PDFs, and documents up to 8 MB.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {task.attachments.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[#0F172A]">{file.name}</p>
                      <p className="text-xs text-[#94A3B8]">{fileSize(file.size)} · {file.author.name}</p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <a className="grid size-8 place-items-center text-[#64748B] hover:text-[#2563EB]" href={`/api/attachments/${file.id}`} aria-label={`Download ${file.name}`}>
                        <Download className="size-4" />
                      </a>
                      <button className="grid size-8 place-items-center text-[#64748B] hover:text-[#EF4444]" aria-label={`Remove ${file.name}`} onClick={() => run(() => api.deleteAttachment(file.id).then(() => undefined), 'Attachment removed')}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {canManage && <TaskFormDialog open={editing} onOpenChange={setEditing} task={task} />}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this task?</DialogTitle>
            <DialogDescription>Comments and files for “{task.title}” will be removed.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await api.deleteTask(task.id)
                  toast.success('Task deleted')
                  navigate('/tasks')
                } catch (error) {
                  toast.error(error instanceof ApiError ? error.message : 'The task could not be deleted.')
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

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[#94A3B8]">{label}</p>
      <div className="mt-0.5 text-[#0F172A]">{value}</div>
    </div>
  )
}
