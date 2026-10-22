import { useQuery } from '@tanstack/react-query'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePage } from '@/components/layout'
import { Card, ErrorState, PriorityBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { deadlineTone } from '@/lib/format'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function shiftMonth(month: string, delta: number) {
  const [year, mon] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year!, (mon || 1) - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function buildGrid(month: string) {
  const [year, mon] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year!, (mon || 1) - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year!, mon || 1, 0)).getUTCDate()
  const cells: { key: string; day: number; inMonth: boolean }[] = []
  for (let index = 0; index < lead; index += 1) {
    const date = new Date(first)
    date.setUTCDate(first.getUTCDate() - (lead - index))
    cells.push({ key: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `${month}-${String(day).padStart(2, '0')}`, day, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]!
    const date = new Date(`${last.key}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + 1)
    cells.push({ key: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: false })
  }
  return cells
}

function monthLabel(month: string) {
  const [year, mon] = month.split('-').map(Number)
  return new Date(Date.UTC(year!, (mon || 1) - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function CalendarPage() {
  const { user, workspace } = useAuth()
  usePage('Calendar', [workspace?.name || 'Northstar', 'Calendar'])
  const zone = user?.timezone || 'Asia/Kolkata'
  const [month, setMonth] = useState(() => formatInTimeZone(new Date(), zone, 'yyyy-MM'))
  const cells = buildGrid(month)
  const from = fromZonedTime(`${cells[0]!.key}T00:00:00`, zone).toISOString()
  const to = fromZonedTime(`${cells[cells.length - 1]!.key}T23:59:59`, zone).toISOString()

  const query = useQuery({
    queryKey: ['tasks', 'calendar', from, to],
    queryFn: async () => {
      const first = await api.tasks({ from, to, page: 1, pageSize: 50, sort: 'deadline', dir: 'asc' })
      const items = [...first.items]
      const pages = Math.min(4, Math.ceil(first.total / first.pageSize))
      for (let page = 2; page <= pages; page += 1) {
        const next = await api.tasks({ from, to, page, pageSize: 50, sort: 'deadline', dir: 'asc' })
        items.push(...next.items)
      }
      return items
    },
  })

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of query.data || []) {
      if (!task.deadline) continue
      const key = formatInTimeZone(new Date(task.deadline), zone, 'yyyy-MM-dd')
      map.set(key, [...(map.get(key) || []), task])
    }
    return map
  }, [query.data, zone])

  const today = formatInTimeZone(new Date(), zone, 'yyyy-MM-dd')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setMonth(formatInTimeZone(new Date(), zone, 'yyyy-MM'))}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth((value) => shiftMonth(value, -1))}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth((value) => shiftMonth(value, 1))}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      {query.isLoading ? (
        <Skeleton className="h-[640px] rounded-2xl" />
      ) : query.isError ? (
        <ErrorState message="The calendar could not be loaded." onRetry={() => query.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium text-[#64748B]">
            {weekdays.map((label) => (
              <div key={label} className="px-2 py-2">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell) => {
              const tasks = byDay.get(cell.key) || []
              return (
                <div key={cell.key} className={cn('min-h-28 border-b border-r border-[#E2E8F0] p-1.5 sm:min-h-32', !cell.inMonth && 'bg-[#F8FAFC]')}>
                  <p className={cn('mb-1 text-xs', cell.key === today ? 'font-semibold text-[#2563EB]' : 'text-[#64748B]')}>{cell.day}</p>
                  <div className="space-y-1">
                    {tasks.slice(0, 3).map((task) => {
                      const tone = deadlineTone(task)
                      return (
                        <Link key={task.id} to={`/tasks/${task.id}`} className="block truncate rounded-md bg-[#EFF6FF] px-1.5 py-1 text-[11px] font-medium text-[#1D4ED8] hover:bg-[#DBEAFE]">
                          <span className={cn(tone === 'overdue' && 'text-[#EF4444]', tone === 'soon' && 'text-[#D97706]')}>{task.title}</span>
                        </Link>
                      )
                    })}
                    {tasks.length > 3 && <p className="px-1 text-[11px] text-[#94A3B8]">+{tasks.length - 3} more</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Deadlines in view</h3>
        <ul className="mt-3 divide-y divide-[#E2E8F0]">
          {(query.data || []).slice(0, 8).map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3 py-2">
              <Link to={`/tasks/${task.id}`} className="truncate text-sm font-medium text-[#0F172A] hover:text-[#2563EB]">{task.title}</Link>
              <PriorityBadge priority={task.priority} />
            </li>
          ))}
          {query.data?.length === 0 && <li className="py-4 text-sm text-[#64748B]">No deadlines in this range.</li>}
        </ul>
      </Card>
    </div>
  )
}
