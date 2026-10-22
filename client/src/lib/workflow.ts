import type { Role, TaskStatus } from './types'

const manager: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED'],
  IN_REVIEW: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'],
  COMPLETED: ['IN_PROGRESS', 'ARCHIVED'],
  ARCHIVED: ['COMPLETED', 'TODO'],
}

const employee: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW'],
  IN_REVIEW: [],
  COMPLETED: [],
  ARCHIVED: [],
}

export function allowedMoves(role: Role, status: TaskStatus) {
  return (role === 'EMPLOYEE' ? employee : manager)[status]
}
