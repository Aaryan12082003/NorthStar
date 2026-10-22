import { formatDistanceToNow } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { Priority, ProjectStatus, Role, TaskStatus } from './types'

export const statusLabel: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

export const priorityLabel: Record<Priority, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

export const projectStatusLabel: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
}

export const roleLabel: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
}

export function greeting(name: string, timeZone: string) {
  const hour = Number(formatInTimeZone(new Date(), timeZone, 'H'))
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${hello}, ${name.split(' ')[0]}`
}

export function formatWhen(value: string | null, timeZone: string) {
  if (!value) return 'No deadline'
  return formatInTimeZone(new Date(value), timeZone, 'd MMM, h:mm a')
}

export function formatDay(value: string | null, timeZone: string) {
  if (!value) return '—'
  return formatInTimeZone(new Date(value), timeZone, 'd MMM yyyy')
}

export function relativeTime(value: string | null) {
  if (!value) return ''
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

export function deadlineTone(task: { deadline: string | null; overdue: boolean; status: string }) {
  if (!task.deadline || task.status === 'COMPLETED' || task.status === 'ARCHIVED') return 'normal'
  if (task.overdue) return 'overdue'
  const hours = (new Date(task.deadline).getTime() - Date.now()) / 3_600_000
  if (hours <= 48) return 'soon'
  return 'normal'
}

export function toStamp(date: string, time: string, timeZone: string) {
  return fromZonedTime(`${date}T${time || '09:00'}:00`, timeZone).toISOString()
}

export function splitStamp(value: string | null, timeZone: string) {
  if (!value) return { date: '', time: '' }
  return {
    date: formatInTimeZone(new Date(value), timeZone, 'yyyy-MM-dd'),
    time: formatInTimeZone(new Date(value), timeZone, 'HH:mm'),
  }
}

export function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
