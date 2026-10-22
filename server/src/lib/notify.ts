import { db } from '../prisma/db.ts'
import { emitUser } from './events.ts'
import { isUniqueViolation } from './http.ts'
import { iso } from './time.ts'

export type PreferenceKey =
  | 'notifyAssigned'
  | 'notifyDueSoon'
  | 'notifyDueToday'
  | 'notifyOverdue'
  | 'notifyReview'
  | 'notifyChanges'

export async function notify(input: {
  userId: string
  workspaceId: string
  type: string
  title: string
  body: string
  taskId?: string | null
  dedupeKey: string
  preference: PreferenceKey
  actorId?: string | null
}) {
  if (input.actorId && input.actorId === input.userId) return null
  const user = await db.orm.public.User.where({ id: input.userId }).first()
  if (!user || user[input.preference] === false) return null
  try {
    const row = await db.orm.public.Notification.create({
      userId: input.userId,
      workspaceId: input.workspaceId,
      type: input.type,
      title: input.title,
      body: input.body,
      taskId: input.taskId ?? null,
      dedupeKey: input.dedupeKey,
    })
    const payload = presentNotification(row)
    emitUser(input.userId, 'notification:created', payload)
    return payload
  } catch (error) {
    if (isUniqueViolation(error)) return null
    throw error
  }
}

export function presentNotification(row: {
  id: string
  type: string
  title: string
  body: string
  taskId: string | null
  readAt: string | null
  createdAt: string
}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    taskId: row.taskId,
    read: Boolean(row.readAt),
    readAt: iso(row.readAt),
    createdAt: iso(row.createdAt),
  }
}

export async function logActivity(input: {
  workspaceId: string
  actorId: string
  type: string
  message: string
  taskId?: string | null
  projectId?: string | null
  createdAt?: string
}) {
  const row = await db.orm.public.ActivityLog.create({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    type: input.type,
    message: input.message,
    taskId: input.taskId ?? null,
    projectId: input.projectId ?? null,
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  })
  return row
}
