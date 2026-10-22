import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Columns3, ListTodo, Rows3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { usePage } from '@/components/layout'
import { Card, EmptyState, ErrorState } from '@/components/common'
import { KanbanBoard, Pager, TaskFiltersBar, TaskTable, defaultFilters, type TaskFilters } from '@/components/task-views'
import { Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import type { TaskStatus } from '@/lib/types'
import { useAuth } from '@/providers/auth'

export function TasksPage({ mine = false }: { mine?: boolean }) {
  const { user, workspace } = useAuth()
  const client = useQueryClient()
  const title = mine ? 'My Tasks' : 'All Tasks'
  usePage(title, [workspace?.name || 'Northstar', title])
  const [view, setView] = useState<'list' | 'board'>('list')
  const [filters, setFilters] = useState<TaskFilters>(defaultFilters)
  const [queryText, setQueryText] = useState('')
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects })
  const members = useQuery({ queryKey: ['members'], queryFn: api.members })

  useEffect(() => {
    const timer = window.setTimeout(() => setQueryText(filters.q), 250)
    return () => window.clearTimeout(timer)
  }, [filters.q])

  const tasks = useQuery({
    queryKey: ['tasks', mine, view, filters, queryText],
    queryFn: () =>
      api.tasks({
        q: queryText,
        status: filters.status,
        priority: filters.priority,
        projectId: filters.projectId,
        assigneeId: mine ? undefined : filters.assigneeId,
        overdue: filters.overdue,
        mine,
        sort: view === 'board' ? 'deadline' : filters.sort,
        dir: filters.dir,
        page: view === 'board' ? 1 : filters.page,
        pageSize: view === 'board' ? 50 : 10,
      }),
  })

  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => api.transition(id, status),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['tasks'] })
      await client.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : 'That move was not allowed.'),
  })

  const sort = (key: string) => {
    setFilters((current) => ({
      ...current,
      sort: key,
      dir: current.sort === key && current.dir === 'asc' ? 'desc' : 'asc',
      page: 1,
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={view} onValueChange={(value) => setView(value as 'list' | 'board')}>
          <TabsList>
            <TabsTrigger value="list"><Rows3 className="mr-1.5 size-3.5" />List</TabsTrigger>
            <TabsTrigger value="board"><Columns3 className="mr-1.5 size-3.5" />Board</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <TaskFiltersBar
        filters={filters}
        onChange={setFilters}
        projects={(projects.data || []).map((project) => ({ id: project.id, name: project.name }))}
        members={(members.data || []).map((member) => ({ id: member.id, name: member.name }))}
        showAssignee={!mine && user?.role !== 'EMPLOYEE'}
      />
      {tasks.isLoading ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : tasks.isError || !tasks.data || !user ? (
        <ErrorState message="Tasks could not be loaded." onRetry={() => tasks.refetch()} />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState icon={<ListTodo className="size-4" />} title="No tasks match" body="Adjust the filters, or create a task for this view." />
      ) : view === 'list' ? (
        <Card className="overflow-hidden">
          <TaskTable tasks={tasks.data.items} timeZone={user.timezone} sort={filters.sort} dir={filters.dir} onSort={sort} />
          <Pager page={tasks.data.page} pageSize={tasks.data.pageSize} total={tasks.data.total} onPage={(page) => setFilters({ ...filters, page })} />
        </Card>
      ) : (
        <div className="space-y-2">
          <KanbanBoard tasks={tasks.data.items} onMove={(task, status) => move.mutate({ id: task.id, status })} />
          {tasks.data.total > tasks.data.items.length && (
            <p className="text-xs text-[#64748B]">Showing the first {tasks.data.items.length} of {tasks.data.total}. Narrow the filters to see the rest on the board.</p>
          )}
        </div>
      )}
    </div>
  )
}
