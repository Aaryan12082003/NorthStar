import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { deadlineTone, formatWhen, statusLabel } from '@/lib/format'
import type { Priority, Task, TaskStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AvatarStack, PriorityBadge, StatusBadge } from './common'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const columns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED']

export type TaskFilters = {
  q: string
  status: string
  priority: string
  projectId: string
  assigneeId: string
  overdue: boolean
  sort: string
  dir: 'asc' | 'desc'
  page: number
}

export const defaultFilters: TaskFilters = {
  q: '',
  status: '',
  priority: '',
  projectId: '',
  assigneeId: '',
  overdue: false,
  sort: 'deadline',
  dir: 'asc',
  page: 1,
}

export function TaskFiltersBar({
  filters,
  onChange,
  projects,
  members,
  showAssignee,
}: {
  filters: TaskFilters
  onChange: (filters: TaskFilters) => void
  projects: { id: string; name: string }[]
  members: { id: string; name: string }[]
  showAssignee?: boolean
}) {
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch, page: patch.page ?? 1 })
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
      <Input value={filters.q} placeholder="Search tasks" onChange={(event) => set({ q: event.target.value })} />
      <FilterSelect value={filters.status || 'all'} placeholder="Status" onChange={(status) => set({ status: status === 'all' ? '' : status })} options={[['all', 'All statuses'], ...Object.entries(statusLabel)]} />
      <FilterSelect value={filters.priority || 'all'} placeholder="Priority" onChange={(priority) => set({ priority: priority === 'all' ? '' : priority })} options={[['all', 'All priorities'], ['URGENT', 'Urgent'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']]} />
      <FilterSelect value={filters.projectId || 'all'} placeholder="Project" onChange={(projectId) => set({ projectId: projectId === 'all' ? '' : projectId })} options={[['all', 'All projects'], ...projects.map((project) => [project.id, project.name] as [string, string])]} />
      {showAssignee && (
        <FilterSelect value={filters.assigneeId || 'all'} placeholder="Employee" onChange={(assigneeId) => set({ assigneeId: assigneeId === 'all' ? '' : assigneeId })} options={[['all', 'Everyone'], ...members.map((member) => [member.id, member.name] as [string, string])]} />
      )}
      <Button variant={filters.overdue ? 'soft' : 'outline'} onClick={() => set({ overdue: !filters.overdue })}>Overdue only</Button>
    </div>
  )
}

function FilterSelect({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: [string, string][]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map(([option, label]) => <SelectItem key={option} value={option}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function TaskTable({
  tasks,
  timeZone,
  sort,
  dir,
  onSort,
}: {
  tasks: Task[]
  timeZone: string
  sort: string
  dir: 'asc' | 'desc'
  onSort: (sort: string) => void
}) {
  const header = (key: string, label: string) => (
    <button className="inline-flex items-center gap-1" onClick={() => onSort(key)} type="button">
      {label}
      {sort === key && <span className="text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-[#E2E8F0] text-left text-xs font-medium uppercase tracking-wide text-[#64748B]">
            <th className="px-4 py-3 font-medium">{header('title', 'Task')}</th>
            <th className="px-4 py-3 font-medium">Project</th>
            <th className="px-4 py-3 font-medium">Assignee</th>
            <th className="px-4 py-3 font-medium">{header('priority', 'Priority')}</th>
            <th className="px-4 py-3 font-medium">{header('deadline', 'Deadline')}</th>
            <th className="px-4 py-3 font-medium">{header('status', 'Status')}</th>
            <th className="px-4 py-3 font-medium"> </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const tone = deadlineTone(task)
            return (
              <tr key={task.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                <td className="px-4 py-3">
                  <Link to={`/tasks/${task.id}`} className="font-medium text-[#0F172A] hover:text-[#2563EB]">{task.title}</Link>
                  {task.tags.length > 0 && <p className="mt-1 text-xs text-[#94A3B8]">{task.tags.map((tag) => tag.name).join(' · ')}</p>}
                </td>
                <td className="px-4 py-3 text-[#64748B]">{task.project.name}</td>
                <td className="px-4 py-3"><AvatarStack people={task.assignees.map((person) => ({ name: person.name, avatarColor: person.avatarColor }))} /></td>
                <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                <td className={cn('px-4 py-3', tone === 'overdue' && 'font-medium text-[#EF4444]', tone === 'soon' && 'font-medium text-[#D97706]')}>{formatWhen(task.deadline, timeZone)}</td>
                <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                <td className="px-4 py-3 text-right"><Link to={`/tasks/${task.id}`} className="text-sm font-medium text-[#2563EB]">Open</Link></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function KanbanBoard({ tasks, onMove }: { tasks: Task[]; onMove: (task: Task, status: TaskStatus) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = tasks.find((task) => task.id === activeId)
  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const task = tasks.find((item) => item.id === event.active.id)
    const status = event.over?.id
    if (!task || typeof status !== 'string' || task.status === status) return
    onMove(task, status as TaskStatus)
  }
  return (
    <DndContext sensors={sensors} onDragStart={(event) => setActiveId(String(event.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((status) => (
          <Column key={status} status={status} tasks={tasks.filter((task) => task.status === status)} />
        ))}
      </div>
      <DragOverlay>{active ? <TaskCard task={active} overlay /> : null}</DragOverlay>
    </DndContext>
  )
}

function Column({ status, tasks }: { status: TaskStatus; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section className={cn('w-[260px] shrink-0 rounded-2xl bg-[#F8FAFC] p-2.5', isOver && 'ring-2 ring-[#2563EB]/20')}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-[#0F172A]">{statusLabel[status]}</h3>
        <span className="text-xs text-[#64748B]">{tasks.length}</span>
      </div>
      <div ref={setNodeRef} className="min-h-40 space-y-2">
        {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
      </div>
    </section>
  )
}

function TaskCard({ task, overlay = false }: { task: Task; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: overlay })
  const tone = deadlineTone(task)
  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      className={cn('rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-card', isDragging && 'opacity-40', overlay && 'shadow-lg')}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
    >
      <Link to={`/tasks/${task.id}`} className="text-sm font-medium text-[#0F172A]" onPointerDown={(event) => event.stopPropagation()}>{task.title}</Link>
      <p className="mt-1 text-xs text-[#64748B]">{task.project.name}</p>
      <div className="mt-3 flex items-center justify-between">
        <PriorityBadge priority={task.priority as Priority} />
        <span className={cn('text-xs', tone === 'overdue' ? 'text-[#EF4444]' : tone === 'soon' ? 'text-[#D97706]' : 'text-[#64748B]')}>
          {task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}
        </span>
      </div>
    </article>
  )
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-sm text-[#64748B]">
      <span>{total} tasks</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span>{page} / {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  )
}
