import type { DashboardData, Member, NotificationItem, Project, ReportData, SessionUser, Task, Workspace } from './types'

export class ApiError extends Error {
  status: number
  issues: { path: string; message: string }[]

  constructor(status: number, message: string, issues: { path: string; message: string }[] = []) {
    super(message)
    this.status = status
    this.issues = issues
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(path, { ...init, headers, credentials: 'include' })
  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    if (!response.ok) throw new ApiError(response.status, 'Something went wrong.')
    return (await response.blob()) as T
  }
  const data = await response.json()
  if (!response.ok) throw new ApiError(response.status, data.error || 'Something went wrong.', data.issues || [])
  return data as T
}

export const api = {
  me: () => request<{ user: SessionUser; workspace: Workspace }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: SessionUser; workspace: Workspace }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  updateMe: (body: unknown) => request<{ user: SessionUser; workspace: Workspace }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
  renameWorkspace: (name: string) => request<Workspace>('/api/workspace', { method: 'PATCH', body: JSON.stringify({ name }) }),
  dashboard: () => request<DashboardData>('/api/dashboard'),
  search: (q: string) => request<{ tasks: { id: string; title: string; project: string; status: string }[]; projects: { id: string; name: string }[]; members: { id: string; name: string; title: string; avatarColor: string }[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  tasks: (params: Record<string, string | number | boolean | undefined>) => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '' || value === false) continue
      query.set(key, value === true ? '1' : String(value))
    }
    return request<{ items: Task[]; total: number; page: number; pageSize: number }>(`/api/tasks?${query}`)
  },
  task: (id: string) => request<Task>(`/api/tasks/${id}`),
  createTask: (body: unknown) => request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (id: string, body: unknown) => request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTask: (id: string) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  transition: (id: string, status: string) => request<Task>(`/api/tasks/${id}/transition`, { method: 'POST', body: JSON.stringify({ status }) }),
  review: (id: string, action: 'approve' | 'return', note: string) =>
    request<Task>(`/api/tasks/${id}/review`, { method: 'POST', body: JSON.stringify({ action, note }) }),
  comment: (id: string, body: string) => request<Task>(`/api/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  subtask: (id: string, done: boolean) => request<Task>(`/api/subtasks/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
  upload: (id: string, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return request<Task>(`/api/tasks/${id}/attachments`, { method: 'POST', body })
  },
  deleteAttachment: (id: string) => request(`/api/attachments/${id}`, { method: 'DELETE' }),
  projects: () => request<Project[]>('/api/projects'),
  project: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (body: unknown) => request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id: string, body: unknown) => request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteProject: (id: string) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  members: () => request<Member[]>('/api/members'),
  member: (id: string) => request<Member>(`/api/members/${id}`),
  createMember: (body: unknown) => request<Member>('/api/members', { method: 'POST', body: JSON.stringify(body) }),
  updateMember: (id: string, role: string) => request<Member>(`/api/members/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeMember: (id: string) => request(`/api/members/${id}`, { method: 'DELETE' }),
  notifications: () => request<{ items: NotificationItem[]; unreadCount: number }>('/api/notifications'),
  readNotification: (id: string) => request(`/api/notifications/${id}/read`, { method: 'POST' }),
  readAllNotifications: () => request('/api/notifications/read-all', { method: 'POST' }),
  reports: (from: string, to: string) => request<ReportData>(`/api/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
}

export async function downloadReport(format: 'csv' | 'xlsx', from: string, to: string) {
  const response = await fetch(`/api/reports/export?format=${format}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { credentials: 'include' })
  if (!response.ok) throw new ApiError(response.status, 'The export did not complete.')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = format === 'csv' ? 'northstar-report.csv' : 'northstar-report.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}
