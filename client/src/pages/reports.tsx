import { useQuery } from '@tanstack/react-query'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { usePage } from '@/components/layout'
import { Avatar, Card, ErrorState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { api, ApiError, downloadReport } from '@/lib/api'
import { useAuth } from '@/providers/auth'

const tip = {
  background: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  fontSize: 12,
  color: '#0F172A',
}

export function ReportsPage() {
  const { user, workspace } = useAuth()
  usePage('Reports', [workspace?.name || 'Northstar', 'Reports'])
  const zone = user?.timezone || 'Asia/Kolkata'
  const defaults = useMemo(() => {
    const today = formatInTimeZone(new Date(), zone, 'yyyy-MM-dd')
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return { from: formatInTimeZone(start, zone, 'yyyy-MM-dd'), to: today }
  }, [zone])
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const range = {
    from: fromZonedTime(`${from}T00:00:00`, zone).toISOString(),
    to: fromZonedTime(`${to}T23:59:59`, zone).toISOString(),
  }
  const query = useQuery({ queryKey: ['reports', range.from, range.to], queryFn: () => api.reports(range.from, range.to) })

  const exportFile = async (format: 'csv' | 'xlsx') => {
    try {
      await downloadReport(format, range.from, range.to)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The export did not complete.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="grid gap-1">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportFile('csv')}><Download className="size-4" /> CSV</Button>
          <Button variant="outline" onClick={() => exportFile('xlsx')}><Download className="size-4" /> Excel</Button>
        </div>
      </div>
      {query.isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : query.isError || !query.data ? (
        <ErrorState message="The report could not be loaded." onRetry={() => query.refetch()} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="On-time completion" value={query.data.onTimePercentage === null ? '—' : `${query.data.onTimePercentage}%`} hint="Completed work that landed by its deadline" />
            <Metric label="Average duration" value={query.data.averageCompletionHours === null ? '—' : `${query.data.averageCompletionHours} h`} hint="From start (or creation) to completion" />
            <Metric label="People in view" value={String(query.data.completedByEmployee.length)} hint="Productivity blends on-time rate, volume, and overdue share" />
            <Metric label="Projects overdue" value={String(query.data.overdueByProject.length)} hint="Projects with at least one slipped deadline in range" />
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Weekly trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={query.data.weekly}>
                    <CartesianGrid stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} width={28} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tip} />
                    <Legend />
                    <Line type="monotone" dataKey="created" name="Created" stroke="#94A3B8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#2563EB" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Monthly trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={query.data.monthly}>
                    <CartesianGrid stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} width={28} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tip} />
                    <Legend />
                    <Bar dataKey="created" name="Created" fill="#BFDBFE" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="completed" name="Completed" fill="#2563EB" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>
          <Card className="overflow-hidden">
            <div className="px-5 py-4">
              <h3 className="text-sm font-semibold">Employee productivity</h3>
              <p className="text-xs text-[#64748B]">Score is 50% on-time rate, 30% completed volume against the team median, and 20% the share of work that is not overdue.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-left text-xs uppercase tracking-wide text-[#64748B]">
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Completed</th>
                    <th className="px-4 py-3 font-medium">On time</th>
                    <th className="px-4 py-3 font-medium">Avg hours</th>
                    <th className="px-4 py-3 font-medium">Overdue</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.completedByEmployee.map((row) => (
                    <tr key={row.id} className="border-b border-[#E2E8F0] last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={row.name} color={row.avatarColor} className="size-7 text-[10px]" />
                          <span>
                            <span className="block font-medium">{row.name}</span>
                            <span className="block text-xs text-[#64748B]">{row.title}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{row.completed}</td>
                      <td className="px-4 py-3">{row.onTimeRate === null ? '—' : `${row.onTimeRate}%`}</td>
                      <td className="px-4 py-3">{row.avgDurationHours === null ? '—' : row.avgDurationHours}</td>
                      <td className={`px-4 py-3 ${row.overdue ? 'text-[#EF4444]' : ''}`}>{row.overdue}</td>
                      <td className="px-4 py-3 font-medium">{row.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <section className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Overdue by project</h3>
              {query.data.overdueByProject.length === 0 ? (
                <p className="py-8 text-sm text-[#64748B]">No overdue tasks in this range.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {query.data.overdueByProject.map((row) => (
                    <li key={row.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: row.color }} />{row.name}</span>
                      <span className="font-medium text-[#EF4444]">{row.overdue}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <h3 className="text-sm font-semibold">Workload</h3>
              <ul className="mt-3 space-y-3">
                {query.data.workload.map((row) => (
                  <li key={row.id} className="flex items-center justify-between text-sm">
                    <span>{row.name}</span>
                    <span className="text-[#64748B]">{row.openTasks} open{row.overdue ? ` · ${row.overdue} overdue` : ''}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-[#64748B]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-[#94A3B8]">{hint}</p>
    </Card>
  )
}
