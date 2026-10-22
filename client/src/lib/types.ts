export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
export type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'ARCHIVED'
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'

export type Preferences = {
  notifyAssigned: boolean
  notifyDueSoon: boolean
  notifyDueToday: boolean
  notifyOverdue: boolean
  notifyReview: boolean
  notifyChanges: boolean
}

export type SessionUser = {
  id: string
  email: string
  name: string
  title: string
  timezone: string
  avatarColor: string
  role: Role
  preferences: Preferences
}

export type Workspace = { id: string; name: string; slug: string }

export type Person = { id: string; name: string; title: string; avatarColor: string }

export type Task = {
  id: string
  title: string
  description: string
  priority: Priority
  status: TaskStatus
  startDate: string | null
  deadline: string | null
  estimatedHours: number
  overdue: boolean
  reviewNote: string
  submittedAt: string | null
  reviewedAt: string | null
  completedAt: string | null
  seriesId: string | null
  createdAt: string | null
  updatedAt: string | null
  project: { id: string; name: string; color: string }
  assignees: Person[]
  tags: { id: string; name: string; color: string }[]
  subtasks: { id: string; title: string; done: boolean; position: number }[]
  createdBy: Person
  reviewedBy: Person | null
  commentCount: number
  attachmentCount: number
  comments: { id: string; body: string; createdAt: string | null; author: Person }[]
  attachments: { id: string; name: string; mimeType: string; size: number; createdAt: string | null; author: Person }[]
  recurrence: { frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; interval: number; nextRunAt: string | null; active: boolean } | null
}

export type Project = {
  id: string
  name: string
  description: string
  status: ProjectStatus
  startDate: string | null
  deadline: string | null
  color: string
  progress: number
  taskCount: number
  completedCount: number
  overdueCount: number
  owner: Person
  members: Person[]
  activity?: { id: string; type: string; message: string; createdAt: string | null; actor: Person }[]
}

export type Member = {
  id: string
  name: string
  email: string
  title: string
  role: Role
  avatarColor: string
  timezone: string
  assigned: number
  completed: number
  overdue: number
  tasks?: Task[]
  activity?: { id: string; type: string; message: string; createdAt: string | null; actor: Person }[]
}

export type NotificationItem = {
  id: string
  type: string
  title: string
  body: string
  taskId: string | null
  read: boolean
  createdAt: string | null
}

export type Activity = {
  id: string
  type: string
  message: string
  taskId?: string | null
  createdAt: string | null
  actor: Person
}

export type DashboardData = {
  stats: Record<'total' | 'completed' | 'inProgress' | 'overdue', { value: number; caption: string; tone: 'good' | 'bad' | 'neutral' }>
  completedOverTime: { date: string; count: number }[]
  byStatus: { status: TaskStatus; count: number }[]
  byPriority: { priority: Priority; count: number }[]
  workload: { id: string; name: string; fullName: string; avatarColor: string; tasks: number; hours: number }[]
  upcoming: Task[]
  activity: Activity[]
}

export type ReportData = {
  from: string
  to: string
  onTimePercentage: number | null
  averageCompletionHours: number | null
  completedByEmployee: {
    id: string
    name: string
    title: string
    avatarColor: string
    completed: number
    onTimeRate: number | null
    avgDurationHours: number | null
    overdue: number
    score: number
  }[]
  overdueByProject: { id: string; name: string; color: string; overdue: number }[]
  workload: { id: string; name: string; openTasks: number; overdue: number }[]
  weekly: { week: string; completed: number; created: number }[]
  monthly: { month: string; completed: number; created: number }[]
}
