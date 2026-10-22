import { db } from '../prisma/db.ts'
import type { AuthContext, Role } from './auth.ts'
import { assertRole } from './auth.ts'
import { emitWorkspace } from './events.ts'
import { HttpError, isUniqueViolation } from './http.ts'
import { logActivity, notify, type PreferenceKey } from './notify.ts'
import { addInterval, calendarDay, dayDiff, hoursBetween, iso } from './time.ts'

const OPEN = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] as const
const TAG_COLORS = ['#2563EB', '#8B5CF6', '#16A34A', '#F59E0B', '#EF4444', '#0EA5E9', '#DB2777', '#64748B']
const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export type TaskInput = {
  title: string
  description?: string
  projectId: string
  assigneeIds: string[]
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'
  status?: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'ARCHIVED'
  startDate?: string | null
  deadline?: string | null
  estimatedHours?: number
  tags?: string[]
  subtasks?: { title: string; done?: boolean }[]
  recurrence?: { frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; interval: number } | null
}

type Person = { id: string; name: string; title: string; avatarColor: string }

function person(user: Person) {
  return { id: user.id, name: user.name, title: user.title, avatarColor: user.avatarColor }
}

function isOpen(status: string) {
  return OPEN.includes(status as (typeof OPEN)[number])
}

export function taskIsOverdue(task: { status: string; deadline: string | null }, now = new Date()) {
  if (!task.deadline || !isOpen(task.status)) return false
  return new Date(task.deadline).getTime() < now.getTime()
}

const taskWith = () =>
  db.orm.public.Task.include('project')
    .include('assignees', (assignees) => assignees.include('user'))
    .include('tags', (tags) => tags.include('tag'))
    .include('subtasks', (subtasks) => subtasks.orderBy((row) => row.position.asc()))
    .include('createdBy')
    .include('reviewedBy')

type LoadedTask = NonNullable<Awaited<ReturnType<ReturnType<typeof taskWith>['first']>>>

function presentTask(task: LoadedTask, extras?: { comments?: unknown; attachments?: unknown }) {
  const comments = extras?.comments ?? []
  const attachments = extras?.attachments ?? []
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    startDate: iso(task.startDate),
    deadline: iso(task.deadline),
    estimatedHours: task.estimatedHours,
    overdue: taskIsOverdue(task),
    reviewNote: task.reviewNote,
    submittedAt: iso(task.submittedAt),
    reviewedAt: iso(task.reviewedAt),
    completedAt: iso(task.completedAt),
    seriesId: task.seriesId,
    createdAt: iso(task.createdAt),
    updatedAt: iso(task.updatedAt),
    project: { id: task.project.id, name: task.project.name, color: task.project.color },
    assignees: task.assignees.map((row) => person(row.user)),
    tags: task.tags.map((row) => ({ id: row.tag.id, name: row.tag.name, color: row.tag.color })),
    subtasks: task.subtasks.map((row) => ({
      id: row.id,
      title: row.title,
      done: row.done,
      position: row.position,
    })),
    createdBy: person(task.createdBy),
    reviewedBy: task.reviewedBy ? person(task.reviewedBy) : null,
    commentCount: Array.isArray(comments) ? comments.length : 0,
    attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
    comments: Array.isArray(comments) ? comments : [],
    attachments: Array.isArray(attachments) ? attachments : [],
  }
}

async function loadTask(id: string) {
  return taskWith().where({ id }).first()
}

export async function assertTask(auth: AuthContext, id: string) {
  const task = await loadTask(id)
  if (!task || task.workspaceId !== auth.workspaceId) throw new HttpError(404, 'Task not found.')
  if (auth.role === 'EMPLOYEE' && !task.assignees.some((row) => row.userId === auth.user.id)) {
    throw new HttpError(404, 'Task not found.')
  }
  return task
}

async function membersByIds(workspaceId: string, ids: string[]) {
  const unique = [...new Set(ids)]
  const rows = await db.orm.public.WorkspaceMember.where({ workspaceId })
    .where((row) => row.userId.in(unique))
    .all()
  if (rows.length !== unique.length) throw new HttpError(400, 'Choose people from this workspace.')
  return unique
}

async function assertProject(auth: AuthContext, projectId: string) {
  const project = await db.orm.public.Project.where({ id: projectId, workspaceId: auth.workspaceId })
    .include('members')
    .first()
  if (!project) throw new HttpError(400, 'Choose a project in this workspace.')
  if (auth.role === 'EMPLOYEE') {
    const allowed = project.ownerId === auth.user.id || project.members.some((row) => row.userId === auth.user.id)
    if (!allowed) throw new HttpError(404, 'Project not found.')
  }
  return project
}

async function syncTags(workspaceId: string, taskId: string, names: string[]) {
  const cleaned = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  const existingLinks = await db.orm.public.TaskTag.where({ taskId }).all()
  if (existingLinks.length) {
    await db.orm.public.TaskTag.where({ taskId }).deleteAll()
  }
  const tags = await db.orm.public.Tag.where({ workspaceId }).all()
  for (const name of cleaned) {
    let tag = tags.find((row) => row.name.toLowerCase() === name.toLowerCase())
    if (!tag) {
      tag = await db.orm.public.Tag.create({
        workspaceId,
        name,
        color: TAG_COLORS[tags.length % TAG_COLORS.length]!,
      })
      tags.push(tag)
    }
    await db.orm.public.TaskTag.create({ taskId, tagId: tag.id })
  }
}

async function replaceSubtasks(taskId: string, subtasks: { title: string; done?: boolean }[]) {
  const current = await db.orm.public.Subtask.where({ taskId }).all()
  if (current.length) await db.orm.public.Subtask.where({ taskId }).deleteAll()
  for (const [index, subtask] of subtasks.entries()) {
    await db.orm.public.Subtask.create({
      taskId,
      title: subtask.title.trim(),
      done: Boolean(subtask.done),
      position: index,
    })
  }
}

async function replaceAssignees(taskId: string, userIds: string[]) {
  const current = await db.orm.public.TaskAssignee.where({ taskId }).all()
  if (current.length) await db.orm.public.TaskAssignee.where({ taskId }).deleteAll()
  for (const userId of userIds) await db.orm.public.TaskAssignee.create({ taskId, userId })
}

function deadlineToneChanged(previous: string | null, next: string | null) {
  if (!previous && !next) return false
  if (!previous || !next) return true
  return new Date(previous).getTime() !== new Date(next).getTime()
}

async function detail(taskId: string) {
  const task = await loadTask(taskId)
  if (!task) throw new HttpError(404, 'Task not found.')
  const comments = await db.orm.public.Comment.where({ taskId }).include('user').orderBy((row) => row.createdAt.asc()).all()
  const attachments = await db.orm.public.Attachment.where({ taskId })
    .include('user')
    .orderBy((row) => row.createdAt.desc())
    .all()
  const recurrence = await db.orm.public.RecurringTaskRule.where({ taskId }).first()
  return {
    ...presentTask(task, {
      comments: comments.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: iso(row.createdAt),
        author: person(row.user),
      })),
      attachments: attachments.map((row) => ({
        id: row.id,
        name: row.originalName,
        mimeType: row.mimeType,
        size: row.size,
        createdAt: iso(row.createdAt),
        author: person(row.user),
      })),
    }),
    recurrence: recurrence
      ? {
          frequency: recurrence.frequency,
          interval: recurrence.interval,
          nextRunAt: iso(recurrence.nextRunAt),
          active: recurrence.active,
        }
      : null,
  }
}

export async function listTasks(
  auth: AuthContext,
  query: {
    q?: string
    status?: string
    priority?: string
    projectId?: string
    assigneeId?: string
    overdue?: boolean
    mine?: boolean
    from?: string
    to?: string
    sort?: string
    dir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
  },
) {
  let tasks = taskWith().where({ workspaceId: auth.workspaceId })
  const assigneeId = auth.role === 'EMPLOYEE' || query.mine ? auth.user.id : query.assigneeId
  if (assigneeId) tasks = tasks.where((row) => row.assignees.some((assignee) => assignee.userId.eq(assigneeId)))
  if (query.projectId) tasks = tasks.where({ projectId: query.projectId })
  if (query.q) {
    const term = `%${query.q.replace(/[%_]/g, '')}%`
    tasks = tasks.where((row) => row.title.ilike(term))
  }
  const statuses = (query.status?.split(',').filter(Boolean) ?? []) as ('TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'ARCHIVED')[]
  if (statuses.length) tasks = tasks.where((row) => row.status.in(statuses))
  const priorities = (query.priority?.split(',').filter(Boolean) ?? []) as ('URGENT' | 'HIGH' | 'MEDIUM' | 'LOW')[]
  if (priorities.length) tasks = tasks.where((row) => row.priority.in(priorities))
  if (query.overdue) {
    tasks = tasks
      .where((row) => row.deadline.lt(new Date().toISOString()))
      .where((row) => row.status.in([...OPEN]))
  }
  if (query.from) tasks = tasks.where((row) => row.deadline.gte(query.from!))
  if (query.to) tasks = tasks.where((row) => row.deadline.lte(query.to!))

  const dir = query.dir === 'desc' ? 'desc' : 'asc'
  const sort = query.sort || 'deadline'
  const page = Math.max(1, query.page || 1)
  const pageSize = Math.min(50, Math.max(1, query.pageSize || 10))

  if (sort === 'priority') {
    const rows = await tasks.all()
    rows.sort((a, b) => {
      const delta = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
      return dir === 'desc' ? -delta : delta
    })
    const slice = rows.slice((page - 1) * pageSize, page * pageSize)
    return { items: slice.map((row) => presentTask(row)), total: rows.length, page, pageSize }
  }

  const ordered =
    sort === 'title'
      ? tasks.orderBy((row) => (dir === 'desc' ? row.title.desc() : row.title.asc()))
      : sort === 'status'
        ? tasks.orderBy((row) => (dir === 'desc' ? row.status.desc() : row.status.asc()))
        : sort === 'createdAt'
          ? tasks.orderBy((row) => (dir === 'desc' ? row.createdAt.desc() : row.createdAt.asc()))
          : sort === 'updatedAt'
            ? tasks.orderBy((row) => (dir === 'desc' ? row.updatedAt.desc() : row.updatedAt.asc()))
            : tasks.orderBy((row) => (dir === 'desc' ? row.deadline.desc({ nulls: 'first' }) : row.deadline.asc({ nulls: 'last' })))

  const totals = await tasks.aggregate((aggregate) => ({ count: aggregate.count() }))
  const rows = await ordered.limit(pageSize).offset((page - 1) * pageSize).all()
  return { items: rows.map((row) => presentTask(row)), total: totals.count, page, pageSize }
}

export async function getTask(auth: AuthContext, id: string) {
  await assertTask(auth, id)
  return detail(id)
}

export async function createTask(auth: AuthContext, input: TaskInput) {
  assertRole(auth, ['ADMIN', 'MANAGER'])
  const project = await assertProject(auth, input.projectId)
  const assigneeIds = await membersByIds(auth.workspaceId, input.assigneeIds)
  if (input.startDate && input.deadline && new Date(input.startDate) > new Date(input.deadline)) {
    throw new HttpError(400, 'The start date needs to be on or before the deadline.')
  }
  const status = input.status || 'TODO'
  const now = new Date().toISOString()
  const task = await db.orm.public.Task.create({
    workspaceId: auth.workspaceId,
    projectId: project.id,
    title: input.title.trim(),
    description: input.description?.trim() || '',
    priority: input.priority,
    status,
    startDate: input.startDate ?? null,
    deadline: input.deadline ?? null,
    estimatedHours: input.estimatedHours ?? 0,
    createdById: auth.user.id,
    completedAt: status === 'COMPLETED' ? now : null,
    submittedAt: status === 'IN_REVIEW' ? now : null,
  })
  await replaceAssignees(task.id, assigneeIds)
  await syncTags(auth.workspaceId, task.id, input.tags || [])
  await replaceSubtasks(task.id, input.subtasks || [])
  if (input.recurrence && input.deadline) {
    const next = addInterval(new Date(input.deadline), input.recurrence.frequency, input.recurrence.interval)
    await db.orm.public.RecurringTaskRule.create({
      taskId: task.id,
      frequency: input.recurrence.frequency,
      interval: input.recurrence.interval,
      nextRunAt: next.toISOString(),
      active: true,
    })
  }
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    taskId: task.id,
    projectId: project.id,
    type: 'task.created',
    message: `assigned “${task.title}”`,
  })
  for (const userId of assigneeIds) {
    await notify({
      userId,
      workspaceId: auth.workspaceId,
      type: 'task.assigned',
      preference: 'notifyAssigned',
      title: 'New task assigned',
      body: `${auth.user.name} assigned “${task.title}” to you.`,
      taskId: task.id,
      dedupeKey: `assign:${task.id}:${userId}:${now}`,
      actorId: auth.user.id,
    })
  }
  emitWorkspace(auth.workspaceId, 'tasks:changed', { id: task.id })
  return detail(task.id)
}

export async function updateTask(auth: AuthContext, id: string, input: Partial<TaskInput>) {
  assertRole(auth, ['ADMIN', 'MANAGER'])
  const existing = await assertTask(auth, id)
  if (input.projectId) await assertProject(auth, input.projectId)
  const start = input.startDate === undefined ? existing.startDate : input.startDate
  const deadline = input.deadline === undefined ? existing.deadline : input.deadline
  if (start && deadline && new Date(start) > new Date(deadline)) {
    throw new HttpError(400, 'The start date needs to be on or before the deadline.')
  }
  const previousAssignees = existing.assignees.map((row) => row.userId)
  const nextAssignees = input.assigneeIds ? await membersByIds(auth.workspaceId, input.assigneeIds) : previousAssignees
  await db.orm.public.Task.where({ id }).update({
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
    ...(input.estimatedHours !== undefined ? { estimatedHours: input.estimatedHours } : {}),
    ...(input.status === 'COMPLETED' && !existing.completedAt ? { completedAt: new Date().toISOString() } : {}),
    ...(input.status && input.status !== 'COMPLETED' && input.status !== 'ARCHIVED' ? { completedAt: null } : {}),
  })
  if (input.assigneeIds) await replaceAssignees(id, nextAssignees)
  if (input.tags) await syncTags(auth.workspaceId, id, input.tags)
  if (input.subtasks) await replaceSubtasks(id, input.subtasks)
  const stamp = new Date().toISOString()
  if (input.assigneeIds) {
    const added = nextAssignees.filter((userId) => !previousAssignees.includes(userId))
    const removed = previousAssignees.filter((userId) => !nextAssignees.includes(userId))
    for (const userId of added) {
      await notify({
        userId,
        workspaceId: auth.workspaceId,
        type: 'task.assigned',
        preference: 'notifyAssigned',
        title: 'New task assigned',
        body: `${auth.user.name} assigned “${input.title || existing.title}” to you.`,
        taskId: id,
        dedupeKey: `assign:${id}:${userId}:${stamp}`,
        actorId: auth.user.id,
      })
    }
    if (added.length || removed.length) {
      for (const userId of [...new Set([...previousAssignees, ...nextAssignees])]) {
        if (added.includes(userId)) continue
        await notify({
          userId,
          workspaceId: auth.workspaceId,
          type: 'task.reassigned',
          preference: 'notifyChanges',
          title: 'Task reassigned',
          body: `${auth.user.name} changed who is assigned to “${existing.title}”.`,
          taskId: id,
          dedupeKey: `reassign:${id}:${userId}:${stamp}`,
          actorId: auth.user.id,
        })
      }
    }
  }
  if (input.deadline !== undefined && deadlineToneChanged(existing.deadline, input.deadline ?? null)) {
    for (const userId of nextAssignees) {
      await notify({
        userId,
        workspaceId: auth.workspaceId,
        type: 'task.deadline_changed',
        preference: 'notifyChanges',
        title: 'Deadline changed',
        body: `${auth.user.name} updated the deadline for “${existing.title}”.`,
        taskId: id,
        dedupeKey: `deadline:${id}:${userId}:${stamp}`,
        actorId: auth.user.id,
      })
    }
  }
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    taskId: id,
    projectId: input.projectId || existing.projectId,
    type: 'task.updated',
    message: `updated “${input.title || existing.title}”`,
  })
  emitWorkspace(auth.workspaceId, 'tasks:changed', { id })
  return detail(id)
}

const employeeMoves: Record<string, string[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW'],
  IN_REVIEW: [],
  COMPLETED: [],
  ARCHIVED: [],
}

const managerMoves: Record<string, string[]> = {
  TODO: ['IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED'],
  IN_REVIEW: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['IN_PROGRESS', 'ARCHIVED'],
  ARCHIVED: ['COMPLETED', 'TODO'],
}

export async function transitionTask(auth: AuthContext, id: string, status: string) {
  const task = await assertTask(auth, id)
  if (auth.role === 'EMPLOYEE' && !task.assignees.some((row) => row.userId === auth.user.id)) {
    throw new HttpError(403, 'You can only update tasks assigned to you.')
  }
  const allowed = auth.role === 'EMPLOYEE' ? employeeMoves[task.status] : managerMoves[task.status]
  if (!allowed?.includes(status)) throw new HttpError(400, 'That status change is not available.')
  if (task.status === 'IN_REVIEW' && (status === 'COMPLETED' || status === 'IN_PROGRESS') && auth.role !== 'EMPLOYEE') {
    return reviewTask(auth, id, status === 'COMPLETED' ? 'approve' : 'return', '')
  }
  const now = new Date().toISOString()
  await db.orm.public.Task.where({ id }).update({
    status: status as 'TODO',
    submittedAt: status === 'IN_REVIEW' ? now : task.submittedAt,
    completedAt: status === 'COMPLETED' ? task.completedAt || now : status === 'ARCHIVED' ? task.completedAt : null,
  })
  const verb =
    status === 'IN_PROGRESS' ? 'started' : status === 'IN_REVIEW' ? 'submitted' : status === 'COMPLETED' ? 'completed' : 'moved'
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    taskId: id,
    projectId: task.projectId,
    type: status === 'IN_PROGRESS' ? 'task.started' : status === 'COMPLETED' ? 'task.completed' : 'task.status',
    message: `${verb} “${task.title}”`,
  })
  if (status === 'IN_REVIEW') {
    const managers = await db.orm.public.WorkspaceMember.where({ workspaceId: auth.workspaceId })
      .where((row) => row.role.in(['ADMIN', 'MANAGER']))
      .all()
    const recipients = new Set<string>([task.project.ownerId, ...managers.map((row) => row.userId)])
    for (const userId of recipients) {
      await notify({
        userId,
        workspaceId: auth.workspaceId,
        type: 'task.submitted',
        preference: 'notifyReview',
        title: 'Task ready for review',
        body: `${auth.user.name} submitted “${task.title}” for review.`,
        taskId: id,
        dedupeKey: `review-submit:${id}:${userId}:${now}`,
        actorId: auth.user.id,
      })
    }
  }
  emitWorkspace(auth.workspaceId, 'tasks:changed', { id })
  return detail(id)
}

export async function reviewTask(auth: AuthContext, id: string, action: 'approve' | 'return', note: string) {
  assertRole(auth, ['ADMIN', 'MANAGER'])
  const task = await assertTask(auth, id)
  if (task.status !== 'IN_REVIEW') throw new HttpError(400, 'Only tasks in review can be approved or returned.')
  const now = new Date().toISOString()
  const approved = action === 'approve'
  await db.orm.public.Task.where({ id }).update({
    status: approved ? 'COMPLETED' : 'IN_PROGRESS',
    reviewNote: note,
    reviewedAt: now,
    reviewedById: auth.user.id,
    completedAt: approved ? now : null,
  })
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    taskId: id,
    projectId: task.projectId,
    type: approved ? 'task.approved' : 'task.returned',
    message: approved ? `approved “${task.title}”` : `returned “${task.title}” for changes`,
  })
  for (const assignee of task.assignees) {
    await notify({
      userId: assignee.userId,
      workspaceId: auth.workspaceId,
      type: approved ? 'task.approved' : 'task.returned',
      preference: 'notifyReview',
      title: approved ? 'Task approved' : 'Changes requested',
      body: approved
        ? `${auth.user.name} approved “${task.title}”.`
        : `${auth.user.name} returned “${task.title}”${note ? `: ${note}` : '.'}`,
      taskId: id,
      dedupeKey: `review:${action}:${id}:${assignee.userId}:${now}`,
      actorId: auth.user.id,
    })
  }
  emitWorkspace(auth.workspaceId, 'tasks:changed', { id })
  return detail(id)
}

export async function removeTask(auth: AuthContext, id: string) {
  assertRole(auth, ['ADMIN', 'MANAGER'])
  const task = await assertTask(auth, id)
  await db.orm.public.Task.where({ id }).delete()
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    projectId: task.projectId,
    type: 'task.deleted',
    message: `deleted “${task.title}”`,
  })
  emitWorkspace(auth.workspaceId, 'tasks:changed', { id })
}

export async function addComment(auth: AuthContext, taskId: string, body: string) {
  await assertTask(auth, taskId)
  const task = await db.orm.public.Task.where({ id: taskId }).first()
  await db.orm.public.Comment.create({ taskId, userId: auth.user.id, body: body.trim() })
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    taskId,
    projectId: task?.projectId,
    type: 'comment.created',
    message: `commented on “${task?.title || 'a task'}”`,
  })
  emitWorkspace(auth.workspaceId, 'tasks:changed', { id: taskId })
  return detail(taskId)
}

export async function setSubtask(auth: AuthContext, subtaskId: string, done: boolean) {
  const subtask = await db.orm.public.Subtask.where({ id: subtaskId }).first()
  if (!subtask) throw new HttpError(404, 'Checklist item not found.')
  await assertTask(auth, subtask.taskId)
  if (auth.role === 'EMPLOYEE') {
    const task = await assertTask(auth, subtask.taskId)
    if (!task.assignees.some((row) => row.userId === auth.user.id)) {
      throw new HttpError(403, 'You can only update tasks assigned to you.')
    }
  }
  await db.orm.public.Subtask.where({ id: subtaskId }).update({ done })
  emitWorkspace(auth.workspaceId, 'tasks:changed', { id: subtask.taskId })
  return detail(subtask.taskId)
}

export async function saveAttachment(auth: AuthContext, taskId: string, file: { filename: string; originalName: string; mimeType: string; size: number }) {
  const task = await assertTask(auth, taskId)
  const row = await db.orm.public.Attachment.create({
    taskId,
    userId: auth.user.id,
    filename: file.filename,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
  })
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    taskId,
    projectId: task.projectId,
    type: 'attachment.created',
    message: `uploaded a document on “${task.title}”`,
  })
  emitWorkspace(auth.workspaceId, 'tasks:changed', { id: taskId })
  return row
}

export async function removeAttachment(auth: AuthContext, id: string) {
  const row = await db.orm.public.Attachment.where({ id }).include('task').first()
  if (!row || row.task.workspaceId !== auth.workspaceId) throw new HttpError(404, 'Attachment not found.')
  await assertTask(auth, row.taskId)
  if (auth.role === 'EMPLOYEE' && row.userId !== auth.user.id) throw new HttpError(403, 'You can only remove files you uploaded.')
  await db.orm.public.Attachment.where({ id }).delete()
  emitWorkspace(auth.workspaceId, 'tasks:changed', { id: row.taskId })
  return row
}

export async function readAttachment(auth: AuthContext, id: string) {
  const row = await db.orm.public.Attachment.where({ id }).include('task').first()
  if (!row || row.task.workspaceId !== auth.workspaceId) throw new HttpError(404, 'Attachment not found.')
  await assertTask(auth, row.taskId)
  return row
}

function presentProject(project: {
  id: string
  name: string
  description: string
  status: string
  startDate: string | null
  deadline: string | null
  color: string
  createdAt: string
  updatedAt: string
  owner: Person
  members: { user: Person }[]
  tasks: { id: string; status: string }[]
}) {
  const active = project.tasks.filter((task) => task.status !== 'ARCHIVED')
  const completed = active.filter((task) => task.status === 'COMPLETED').length
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: iso(project.startDate),
    deadline: iso(project.deadline),
    color: project.color,
    createdAt: iso(project.createdAt),
    updatedAt: iso(project.updatedAt),
    progress: active.length === 0 ? 0 : Math.round((completed / active.length) * 100),
    taskCount: active.length,
    completedCount: completed,
    overdueCount: 0,
    owner: person(project.owner),
    members: project.members.map((row) => person(row.user)),
  }
}

const projectWith = () =>
  db.orm.public.Project.include('owner')
    .include('members', (members) => members.include('user'))
    .include('tasks', (tasks) => tasks.select('id', 'status', 'deadline'))

export async function listProjects(auth: AuthContext) {
  const rows = await projectWith().where({ workspaceId: auth.workspaceId }).orderBy((row) => row.name.asc()).all()
  const visible =
    auth.role === 'EMPLOYEE'
      ? rows.filter((project) => project.ownerId === auth.user.id || project.members.some((row) => row.userId === auth.user.id))
      : rows
  return visible.map((project) => {
    const presented = presentProject(project)
    presented.overdueCount = project.tasks.filter((task) => taskIsOverdue(task)).length
    return presented
  })
}

export async function getProject(auth: AuthContext, id: string) {
  const project = await projectWith().where({ id, workspaceId: auth.workspaceId }).first()
  if (!project) throw new HttpError(404, 'Project not found.')
  if (
    auth.role === 'EMPLOYEE' &&
    project.ownerId !== auth.user.id &&
    !project.members.some((row) => row.userId === auth.user.id)
  ) {
    throw new HttpError(404, 'Project not found.')
  }
  const activity = await db.orm.public.ActivityLog.where({ workspaceId: auth.workspaceId, projectId: id })
    .include('actor')
    .orderBy((row) => row.createdAt.desc())
    .limit(12)
    .all()
  const presented = presentProject(project)
  presented.overdueCount = project.tasks.filter((task) => taskIsOverdue(task)).length
  return {
    ...presented,
    activity: activity.map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      createdAt: iso(row.createdAt),
      actor: person(row.actor),
    })),
  }
}

export async function createProject(
  auth: AuthContext,
  input: {
    name: string
    description?: string
    ownerId: string
    memberIds: string[]
    status?: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
    startDate?: string | null
    deadline?: string | null
    color?: string
  },
) {
  assertRole(auth, ['ADMIN', 'MANAGER'])
  const memberIds = await membersByIds(auth.workspaceId, [...input.memberIds, input.ownerId])
  if (input.startDate && input.deadline && new Date(input.startDate) > new Date(input.deadline)) {
    throw new HttpError(400, 'The start date needs to be on or before the deadline.')
  }
  const project = await db.orm.public.Project.create({
    workspaceId: auth.workspaceId,
    name: input.name.trim(),
    description: input.description?.trim() || '',
    ownerId: input.ownerId,
    status: input.status || 'ACTIVE',
    startDate: input.startDate ?? null,
    deadline: input.deadline ?? null,
    color: input.color || '#2563EB',
  })
  for (const userId of memberIds) await db.orm.public.ProjectMember.create({ projectId: project.id, userId })
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    projectId: project.id,
    type: 'project.created',
    message: `created the project “${project.name}”`,
  })
  emitWorkspace(auth.workspaceId, 'projects:changed', { id: project.id })
  return getProject(auth, project.id)
}

export async function updateProject(auth: AuthContext, id: string, input: {
  name?: string
  description?: string
  ownerId?: string
  memberIds?: string[]
  status?: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'
  startDate?: string | null
  deadline?: string | null
  color?: string
}) {
  assertRole(auth, ['ADMIN', 'MANAGER'])
  const existing = await db.orm.public.Project.where({ id, workspaceId: auth.workspaceId }).first()
  if (!existing) throw new HttpError(404, 'Project not found.')
  if (input.ownerId || input.memberIds) {
    await membersByIds(auth.workspaceId, [...(input.memberIds || []), input.ownerId || existing.ownerId])
  }
  await db.orm.public.Project.where({ id }).update({
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
  })
  if (input.memberIds) {
    const ids = await membersByIds(auth.workspaceId, [...input.memberIds, input.ownerId || existing.ownerId])
    const current = await db.orm.public.ProjectMember.where({ projectId: id }).all()
    if (current.length) await db.orm.public.ProjectMember.where({ projectId: id }).deleteAll()
    for (const userId of ids) await db.orm.public.ProjectMember.create({ projectId: id, userId })
  }
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    projectId: id,
    type: 'project.updated',
    message: `updated the project “${input.name || existing.name}”`,
  })
  emitWorkspace(auth.workspaceId, 'projects:changed', { id })
  return getProject(auth, id)
}

export async function removeProject(auth: AuthContext, id: string) {
  assertRole(auth, ['ADMIN'])
  const project = await db.orm.public.Project.where({ id, workspaceId: auth.workspaceId }).first()
  if (!project) throw new HttpError(404, 'Project not found.')
  await db.orm.public.Project.where({ id }).delete()
  await logActivity({
    workspaceId: auth.workspaceId,
    actorId: auth.user.id,
    type: 'project.deleted',
    message: `deleted the project “${project.name}”`,
  })
  emitWorkspace(auth.workspaceId, 'projects:changed', { id })
}

export async function listMembers(auth: AuthContext) {
  const members = await db.orm.public.WorkspaceMember.where({ workspaceId: auth.workspaceId })
    .include('user')
    .all()
  const tasks = await db.orm.public.Task.where({ workspaceId: auth.workspaceId })
    .include('assignees')
    .all()
  return members
    .map((member) => {
      const assigned = tasks.filter((task) => task.assignees.some((row) => row.userId === member.userId))
      return {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        title: member.user.title,
        role: member.role as Role,
        avatarColor: member.user.avatarColor,
        timezone: member.user.timezone,
        assigned: assigned.length,
        completed: assigned.filter((task) => task.status === 'COMPLETED').length,
        overdue: assigned.filter((task) => taskIsOverdue(task)).length,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getMember(auth: AuthContext, userId: string) {
  const member = await db.orm.public.WorkspaceMember.where({ workspaceId: auth.workspaceId, userId }).include('user').first()
  if (!member) throw new HttpError(404, 'Team member not found.')
  const canSeeWork = auth.role !== 'EMPLOYEE' || auth.user.id === userId
  const tasks = canSeeWork
    ? await taskWith()
        .where({ workspaceId: auth.workspaceId })
        .where((row) => row.assignees.some((assignee) => assignee.userId.eq(userId)))
        .all()
    : []
  const activity = await db.orm.public.ActivityLog.where({ workspaceId: auth.workspaceId, actorId: userId })
    .include('actor')
    .orderBy((row) => row.createdAt.desc())
    .limit(10)
    .all()
  const presented = tasks.map((task) => presentTask(task))
  return {
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    title: member.user.title,
    role: member.role,
    avatarColor: member.user.avatarColor,
    timezone: member.user.timezone,
    assigned: presented.length,
    completed: presented.filter((task) => task.status === 'COMPLETED').length,
    overdue: presented.filter((task) => task.overdue).length,
    tasks: canSeeWork ? presented : [],
    activity: activity.map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      createdAt: iso(row.createdAt),
      actor: person(row.actor),
    })),
  }
}

const COLORS = ['#2563EB', '#8B5CF6', '#16A34A', '#F59E0B', '#EF4444', '#0EA5E9', '#DB2777']

export async function createMember(
  auth: AuthContext,
  input: { name: string; email: string; title: string; role: Role; password: string },
) {
  assertRole(auth, ['ADMIN'])
  const email = input.email.trim().toLowerCase()
  const existing = await db.orm.public.User.where({ email }).first()
  if (existing) throw new HttpError(409, 'Someone with that email is already here.')
  const { hashPassword } = await import('./auth.ts')
  const user = await db.orm.public.User.create({
    email,
    name: input.name.trim(),
    title: input.title.trim(),
    passwordHash: await hashPassword(input.password),
    avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    timezone: 'Asia/Kolkata',
  })
  try {
    await db.orm.public.WorkspaceMember.create({
      workspaceId: auth.workspaceId,
      userId: user.id,
      role: input.role,
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, 'That person is already in the workspace.')
    throw error
  }
  return getMember(auth, user.id)
}

export async function updateMember(auth: AuthContext, userId: string, role: Role) {
  assertRole(auth, ['ADMIN'])
  const members = await db.orm.public.WorkspaceMember.where({ workspaceId: auth.workspaceId }).all()
  const target = members.find((row) => row.userId === userId)
  if (!target) throw new HttpError(404, 'Team member not found.')
  const admins = members.filter((row) => row.role === 'ADMIN')
  if (target.role === 'ADMIN' && role !== 'ADMIN' && admins.length <= 1) {
    throw new HttpError(400, 'The workspace needs at least one admin.')
  }
  await db.orm.public.WorkspaceMember.where({ id: target.id }).update({ role })
  return getMember(auth, userId)
}

export async function removeMember(auth: AuthContext, userId: string) {
  assertRole(auth, ['ADMIN'])
  if (userId === auth.user.id) throw new HttpError(400, 'You cannot remove yourself.')
  const members = await db.orm.public.WorkspaceMember.where({ workspaceId: auth.workspaceId }).all()
  const target = members.find((row) => row.userId === userId)
  if (!target) throw new HttpError(404, 'Team member not found.')
  if (target.role === 'ADMIN' && members.filter((row) => row.role === 'ADMIN').length <= 1) {
    throw new HttpError(400, 'The workspace needs at least one admin.')
  }
  await db.orm.public.WorkspaceMember.where({ id: target.id }).delete()
}

export async function searchWorkspace(auth: AuthContext, q: string) {
  const term = `%${q.replace(/[%_]/g, '')}%`
  const tasks = await listTasks(auth, { q, page: 1, pageSize: 6 })
  let projects = db.orm.public.Project.where({ workspaceId: auth.workspaceId }).where((row) => row.name.ilike(term))
  const projectRows = await projects.limit(5).all()
  const members = await db.orm.public.WorkspaceMember.where({ workspaceId: auth.workspaceId })
    .include('user')
    .all()
  return {
    tasks: tasks.items.map((task) => ({ id: task.id, title: task.title, project: task.project.name, status: task.status })),
    projects: projectRows
      .filter((project) => auth.role !== 'EMPLOYEE' || project.ownerId === auth.user.id)
      .slice(0, 4)
      .map((project) => ({ id: project.id, name: project.name, status: project.status })),
    members: members
      .filter((member) => member.user.name.toLowerCase().includes(q.toLowerCase()) || member.user.email.includes(q.toLowerCase()))
      .slice(0, 4)
      .map((member) => ({ id: member.user.id, name: member.user.name, title: member.user.title, avatarColor: member.user.avatarColor })),
  }
}

export async function listActivity(auth: AuthContext, limit = 12) {
  const rows = await db.orm.public.ActivityLog.where({ workspaceId: auth.workspaceId })
    .include('actor')
    .orderBy((row) => row.createdAt.desc())
    .limit(limit)
    .all()
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    taskId: row.taskId,
    projectId: row.projectId,
    createdAt: iso(row.createdAt),
    actor: person(row.actor),
  }))
}

export async function dashboard(auth: AuthContext) {
  const tasks = await db.orm.public.Task.where({ workspaceId: auth.workspaceId }).include('assignees', (rows) => rows.include('user')).all()
  const visible = auth.role === 'EMPLOYEE' ? tasks.filter((task) => task.assignees.some((row) => row.userId === auth.user.id)) : tasks
  const now = new Date()
  const week = new Date(now.getTime() - 7 * 86_400_000)
  const prior = new Date(now.getTime() - 14 * 86_400_000)
  const inWindow = (value: string | null, start: Date, end: Date) => {
    if (!value) return false
    const time = new Date(value).getTime()
    return time >= start.getTime() && time < end.getTime()
  }
  const nonArchived = visible.filter((task) => task.status !== 'ARCHIVED')
  const completed = nonArchived.filter((task) => task.status === 'COMPLETED')
  const inProgress = nonArchived.filter((task) => task.status === 'IN_PROGRESS')
  const overdue = nonArchived.filter((task) => taskIsOverdue(task, now))
  const createdThis = nonArchived.filter((task) => inWindow(task.createdAt, week, now)).length
  const completedThis = visible.filter((task) => inWindow(task.completedAt, week, now)).length
  const completedPrev = visible.filter((task) => inWindow(task.completedAt, prior, week)).length
  const slippedThis = overdue.filter((task) => inWindow(task.deadline, week, now)).length
  const activities = await db.orm.public.ActivityLog.where({ workspaceId: auth.workspaceId })
    .where((row) => row.createdAt.gte(week.toISOString()))
    .where((row) => row.type.eq('task.started'))
    .all()
  const days: { date: string; count: number }[] = []
  for (let offset = 13; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * 86_400_000)
    const key = calendarDay(day, auth.user.timezone)
    days.push({
      date: key,
      count: visible.filter((task) => task.completedAt && calendarDay(task.completedAt, auth.user.timezone) === key).length,
    })
  }
  const statuses = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED']
  const priorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']
  const members = await listMembers(auth)
  const workloadSource = auth.role === 'EMPLOYEE' ? members.filter((member) => member.id === auth.user.id) : members
  const upcoming = await listTasks(auth, { sort: 'deadline', dir: 'asc', page: 1, pageSize: 6, status: 'TODO,IN_PROGRESS,IN_REVIEW' })
  return {
    stats: {
      total: { value: nonArchived.length, caption: `+${createdThis} new this week`, tone: 'neutral' as const },
      completed: {
        value: completed.length,
        caption: `${completedThis - completedPrev >= 0 ? '+' : ''}${completedThis - completedPrev} vs the previous week`,
        tone: completedThis - completedPrev >= 0 ? ('good' as const) : ('bad' as const),
      },
      inProgress: { value: inProgress.length, caption: `${activities.length} started this week`, tone: 'neutral' as const },
      overdue: { value: overdue.length, caption: `${slippedThis} slipped this week`, tone: overdue.length ? ('bad' as const) : ('good' as const) },
    },
    completedOverTime: days,
    byStatus: statuses.map((status) => ({ status, count: visible.filter((task) => task.status === status).length })),
    byPriority: priorities.map((priority) => ({
      priority,
      count: nonArchived.filter((task) => task.priority === priority).length,
    })),
    workload: workloadSource.map((member) => {
      const open = visible.filter(
        (task) => isOpen(task.status) && task.assignees.some((row) => row.userId === member.id),
      )
      return {
        id: member.id,
        name: member.name.split(' ')[0],
        fullName: member.name,
        avatarColor: member.avatarColor,
        tasks: open.length,
        hours: Math.round(open.reduce((sum, task) => sum + task.estimatedHours, 0) * 10) / 10,
      }
    }),
    upcoming: upcoming.items,
    activity: await listActivity(auth, 8),
  }
}

export async function buildReport(auth: AuthContext, from: string, to: string) {
  const tasks = await db.orm.public.Task.where({ workspaceId: auth.workspaceId })
    .include('assignees', (rows) => rows.include('user'))
    .include('project')
    .all()
  const members = await listMembers(auth)
  const scopedMembers = auth.role === 'EMPLOYEE' ? members.filter((member) => member.id === auth.user.id) : members
  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime()
  const inRange = (value: string | null) => {
    if (!value) return false
    const time = new Date(value).getTime()
    return time >= fromMs && time <= toMs
  }
  const completed = tasks.filter((task) => task.status === 'COMPLETED' && inRange(task.completedAt))
  const employeeRows = scopedMembers.map((member) => {
    const mine = completed.filter((task) => task.assignees.some((row) => row.userId === member.id))
    const withDeadline = mine.filter((task) => task.deadline)
    const onTime = withDeadline.filter((task) => new Date(task.completedAt || 0).getTime() <= new Date(task.deadline || 0).getTime())
    const durations = mine.map((task) => hoursBetween(task.startDate || task.createdAt, task.completedAt || task.updatedAt))
    const overdue = tasks.filter(
      (task) => taskIsOverdue(task) && task.assignees.some((row) => row.userId === member.id) && inRange(task.deadline),
    )
    return {
      id: member.id,
      name: member.name,
      title: member.title,
      avatarColor: member.avatarColor,
      completed: mine.length,
      onTime: onTime.length,
      withDeadline: withDeadline.length,
      onTimeRate: withDeadline.length ? Math.round((onTime.length / withDeadline.length) * 100) : null,
      avgDurationHours: durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10 : null,
      overdue: overdue.length,
    }
  })
  const median = (() => {
    const values = employeeRows.map((row) => row.completed).sort((a, b) => a - b)
    if (!values.length) return 0
    const mid = Math.floor(values.length / 2)
    return values.length % 2 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2
  })()
  const productivity = employeeRows.map((row) => {
    const onTimePart = (row.onTimeRate ?? 50) / 100
    const volumePart = median === 0 ? (row.completed > 0 ? 1 : 0.4) : Math.min(row.completed / median, 1.25) / 1.25
    const load = row.completed + row.overdue
    const overduePart = 1 - Math.min(load === 0 ? 0 : row.overdue / load, 1)
    const score = Math.round(100 * (0.5 * onTimePart + 0.3 * volumePart + 0.2 * overduePart))
    return { ...row, score }
  })
  const projects = await db.orm.public.Project.where({ workspaceId: auth.workspaceId }).all()
  const overdueByProject = projects.map((project) => ({
    id: project.id,
    name: project.name,
    color: project.color,
    overdue: tasks.filter((task) => task.projectId === project.id && taskIsOverdue(task) && inRange(task.deadline)).length,
  }))
  const withDeadline = completed.filter((task) => task.deadline)
  const onTime = withDeadline.filter((task) => new Date(task.completedAt || 0).getTime() <= new Date(task.deadline || 0).getTime())
  const durations = completed.map((task) => hoursBetween(task.startDate || task.createdAt, task.completedAt || task.updatedAt))
  const weeks = new Map<string, { week: string; completed: number; created: number }>()
  const months = new Map<string, { month: string; completed: number; created: number }>()
  const weekKey = (value: string) => {
    const start = new Date(value)
    const weekStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - start.getUTCDay()))
    return weekStart.toISOString().slice(0, 10)
  }
  const touch = (kind: 'created' | 'completed', value: string) => {
    const week = weekKey(value)
    const month = value.slice(0, 7)
    const weekRow = weeks.get(week) || { week, completed: 0, created: 0 }
    const monthRow = months.get(month) || { month, completed: 0, created: 0 }
    weekRow[kind] += 1
    monthRow[kind] += 1
    weeks.set(week, weekRow)
    months.set(month, monthRow)
  }
  for (const task of tasks) {
    if (inRange(task.createdAt)) touch('created', task.createdAt)
    if (task.completedAt && inRange(task.completedAt)) touch('completed', task.completedAt)
  }
  return {
    from,
    to,
    onTimePercentage: withDeadline.length ? Math.round((onTime.length / withDeadline.length) * 100) : null,
    averageCompletionHours: durations.length ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10 : null,
    completedByEmployee: productivity,
    overdueByProject: overdueByProject.filter((row) => row.overdue > 0),
    workload: scopedMembers.map((member) => ({
      id: member.id,
      name: member.name,
      openTasks: member.assigned - member.completed,
      overdue: member.overdue,
    })),
    weekly: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)),
    monthly: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
  }
}

export async function listNotifications(auth: AuthContext) {
  const rows = await db.orm.public.Notification.where({ userId: auth.user.id, workspaceId: auth.workspaceId })
    .orderBy((row) => row.createdAt.desc())
    .limit(80)
    .all()
  const { presentNotification } = await import('./notify.ts')
  return {
    items: rows.map(presentNotification),
    unreadCount: rows.filter((row) => !row.readAt).length,
  }
}

export async function markNotification(auth: AuthContext, id: string) {
  const row = await db.orm.public.Notification.where({ id, userId: auth.user.id }).first()
  if (!row) throw new HttpError(404, 'Notification not found.')
  await db.orm.public.Notification.where({ id }).update({ readAt: new Date().toISOString() })
}

export async function markAllNotifications(auth: AuthContext) {
  const rows = await db.orm.public.Notification.where({ userId: auth.user.id, workspaceId: auth.workspaceId })
    .where((row) => row.readAt.isNull())
    .all()
  const now = new Date().toISOString()
  for (const row of rows) await db.orm.public.Notification.where({ id: row.id }).update({ readAt: now })
}

export async function runDeadlineReminders() {
  const tasks = await db.orm.public.Task.where((row) => row.status.in([...OPEN]))
    .where((row) => row.deadline.isNotNull())
    .include('assignees', (rows) => rows.include('user'))
    .all()
  const now = new Date()
  for (const task of tasks) {
    if (!task.deadline) continue
    const past = new Date(task.deadline).getTime() < now.getTime()
    for (const assignee of task.assignees) {
      const diff = dayDiff(task.deadline, assignee.user.timezone, now)
      const local = calendarDay(now, assignee.user.timezone)
      if (past) {
        await notify({
          userId: assignee.userId,
          workspaceId: task.workspaceId,
          type: 'task.overdue',
          preference: 'notifyOverdue',
          title: 'Task overdue',
          body: `“${task.title}” is overdue.`,
          taskId: task.id,
          dedupeKey: `overdue:${task.id}:${task.deadline}`,
        })
        continue
      }
      if (diff === 0) {
        await notify({
          userId: assignee.userId,
          workspaceId: task.workspaceId,
          type: 'task.due_today',
          preference: 'notifyDueToday',
          title: 'Due today',
          body: `“${task.title}” is due today.`,
          taskId: task.id,
          dedupeKey: `due-0:${task.id}:${local}`,
        })
      } else if (diff === 1) {
        await notify({
          userId: assignee.userId,
          workspaceId: task.workspaceId,
          type: 'task.due_soon',
          preference: 'notifyDueSoon',
          title: 'Due tomorrow',
          body: `“${task.title}” is due tomorrow.`,
          taskId: task.id,
          dedupeKey: `due-1:${task.id}:${local}`,
        })
      } else if (diff === 3) {
        await notify({
          userId: assignee.userId,
          workspaceId: task.workspaceId,
          type: 'task.due_soon',
          preference: 'notifyDueSoon',
          title: 'Deadline in three days',
          body: `“${task.title}” is due in three days.`,
          taskId: task.id,
          dedupeKey: `due-3:${task.id}:${local}`,
        })
      }
    }
  }
}

export async function runRecurringTasks() {
  const now = new Date()
  const rules = await db.orm.public.RecurringTaskRule.where({ active: true })
    .where((row) => row.nextRunAt.lte(now.toISOString()))
    .all()
  for (const rule of rules) {
    if (rule.endsAt && new Date(rule.endsAt).getTime() < now.getTime()) {
      await db.orm.public.RecurringTaskRule.where({ id: rule.id }).update({ active: false })
      continue
    }
    const template = await loadTask(rule.taskId)
    if (!template) continue
    const occurrenceKey = rule.nextRunAt
    try {
      const created = await db.orm.public.Task.create({
        workspaceId: template.workspaceId,
        projectId: template.projectId,
        title: template.title,
        description: template.description,
        priority: template.priority,
        status: 'TODO',
        startDate: now.toISOString(),
        deadline: occurrenceKey,
        estimatedHours: template.estimatedHours,
        createdById: template.createdById,
        seriesId: template.seriesId || template.id,
      })
      for (const assignee of template.assignees) {
        await db.orm.public.TaskAssignee.create({ taskId: created.id, userId: assignee.userId })
        await notify({
          userId: assignee.userId,
          workspaceId: template.workspaceId,
          type: 'task.assigned',
          preference: 'notifyAssigned',
          title: 'Recurring task is ready',
          body: `A new occurrence of “${template.title}” was created.`,
          taskId: created.id,
          dedupeKey: `recur:${rule.id}:${occurrenceKey}:${assignee.userId}`,
        })
      }
      for (const tag of template.tags) await db.orm.public.TaskTag.create({ taskId: created.id, tagId: tag.tagId })
      for (const subtask of template.subtasks) {
        await db.orm.public.Subtask.create({ taskId: created.id, title: subtask.title, done: false, position: subtask.position })
      }
      let next = new Date(rule.nextRunAt)
      do {
        next = addInterval(next, rule.frequency, rule.interval)
      } while (next.getTime() <= now.getTime())
      await db.orm.public.RecurringTaskRule.where({ id: rule.id }).update({ nextRunAt: next.toISOString() })
      emitWorkspace(template.workspaceId, 'tasks:changed', { id: created.id })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
    }
  }
}

export async function updateProfile(
  auth: AuthContext,
  input: {
    name?: string
    title?: string
    timezone?: string
    preferences?: Partial<Record<PreferenceKey, boolean>>
  },
) {
  await db.orm.public.User.where({ id: auth.user.id }).update({
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.preferences?.notifyAssigned !== undefined ? { notifyAssigned: input.preferences.notifyAssigned } : {}),
    ...(input.preferences?.notifyDueSoon !== undefined ? { notifyDueSoon: input.preferences.notifyDueSoon } : {}),
    ...(input.preferences?.notifyDueToday !== undefined ? { notifyDueToday: input.preferences.notifyDueToday } : {}),
    ...(input.preferences?.notifyOverdue !== undefined ? { notifyOverdue: input.preferences.notifyOverdue } : {}),
    ...(input.preferences?.notifyReview !== undefined ? { notifyReview: input.preferences.notifyReview } : {}),
    ...(input.preferences?.notifyChanges !== undefined ? { notifyChanges: input.preferences.notifyChanges } : {}),
  })
  const refreshed = await getAuthByTokenFromUser(auth.user.id, auth.workspaceId)
  return refreshed
}

async function getAuthByTokenFromUser(userId: string, workspaceId: string) {
  const user = await db.orm.public.User.where({ id: userId }).first()
  const membership = await db.orm.public.WorkspaceMember.where({ userId, workspaceId }).include('workspace').first()
  if (!user || !membership) throw new HttpError(401, 'Sign in to continue.')
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      title: user.title,
      timezone: user.timezone,
      avatarColor: user.avatarColor,
      role: membership.role,
      preferences: {
        notifyAssigned: user.notifyAssigned,
        notifyDueSoon: user.notifyDueSoon,
        notifyDueToday: user.notifyDueToday,
        notifyOverdue: user.notifyOverdue,
        notifyReview: user.notifyReview,
        notifyChanges: user.notifyChanges,
      },
    },
    workspace: { id: membership.workspace.id, name: membership.workspace.name, slug: membership.workspace.slug },
  }
}

export async function renameWorkspace(auth: AuthContext, name: string) {
  assertRole(auth, ['ADMIN'])
  await db.orm.public.Workspace.where({ id: auth.workspaceId }).update({ name: name.trim() })
  return { id: auth.workspaceId, name: name.trim(), slug: auth.workspaceSlug }
}
