import type { ComponentProps, ReactNode } from 'react'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Priority, ProjectStatus, Role, TaskStatus } from '@/lib/types'
import { priorityLabel, projectStatusLabel, roleLabel, statusLabel } from '@/lib/format'
import { Badge } from './ui/misc'

export function Avatar({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      className={cn('grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white', className)}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}

export function AvatarStack({ people }: { people: { name: string; avatarColor: string }[] }) {
  return (
    <div className="flex -space-x-1.5">
      {people.slice(0, 3).map((person) => (
        <Avatar key={person.name} name={person.name} color={person.avatarColor} className="size-6 ring-2 ring-white text-[10px]" />
      ))}
      {people.length > 3 && <span className="grid size-6 place-items-center rounded-full bg-[#F1F5F9] text-[10px] text-[#64748B] ring-2 ring-white">+{people.length - 3}</span>}
    </div>
  )
}

const priorityClass: Record<Priority, string> = {
  URGENT: 'bg-[#FEF2F2] text-[#EF4444]',
  HIGH: 'bg-[#FFFBEB] text-[#B45309]',
  MEDIUM: 'bg-[#EFF6FF] text-[#2563EB]',
  LOW: 'bg-[#F8FAFC] text-[#64748B]',
}

const statusClass: Record<TaskStatus, string> = {
  TODO: 'bg-[#F8FAFC] text-[#64748B]',
  IN_PROGRESS: 'bg-[#EFF6FF] text-[#2563EB]',
  IN_REVIEW: 'bg-[#F5F3FF] text-[#7C3AED]',
  COMPLETED: 'bg-[#F0FDF4] text-[#16A34A]',
  ARCHIVED: 'bg-[#F8FAFC] text-[#94A3B8]',
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={priorityClass[priority]}>{priorityLabel[priority]}</Badge>
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={statusClass[status]}>{statusLabel[status]}</Badge>
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge className={role === 'ADMIN' ? 'bg-[#EFF6FF] text-[#2563EB]' : role === 'MANAGER' ? 'bg-[#F5F3FF] text-[#7C3AED]' : 'bg-[#F8FAFC] text-[#64748B]'}>{roleLabel[role]}</Badge>
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge className={status === 'ACTIVE' ? 'bg-[#F0FDF4] text-[#16A34A]' : status === 'COMPLETED' ? 'bg-[#EFF6FF] text-[#2563EB]' : status === 'ON_HOLD' ? 'bg-[#FFFBEB] text-[#B45309]' : 'bg-[#F8FAFC] text-[#64748B]'}>{projectStatusLabel[status]}</Badge>
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-white px-6 py-14 text-center">
      <div className="mx-auto grid size-10 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">{icon}</div>
      <h3 className="mt-4 text-sm font-semibold text-[#0F172A]">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[#64748B]">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-[#0F172A]">This page didn't load</p>
      <p className="mt-1 text-sm text-[#64748B]">{message}</p>
      {onRetry && (
        <button className="mt-4 text-sm font-medium text-[#2563EB]" onClick={onRetry} type="button">
          Try again
        </button>
      )}
    </div>
  )
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl border border-[#E2E8F0] bg-white shadow-card', className)} {...props} />
}
