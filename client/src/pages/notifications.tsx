import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePage } from '@/components/layout'
import { Card, EmptyState, ErrorState } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { api } from '@/lib/api'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth'

export function NotificationsPage() {
  const { workspace } = useAuth()
  usePage('Notifications', [workspace?.name || 'Northstar', 'Notifications'])
  const navigate = useNavigate()
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['notifications'], queryFn: api.notifications })

  const open = async (id: string, taskId: string | null, read: boolean) => {
    if (!read) {
      await api.readNotification(id)
      await client.invalidateQueries({ queryKey: ['notifications'] })
    }
    if (taskId) navigate(`/tasks/${taskId}`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          disabled={!query.data?.unreadCount}
          onClick={async () => {
            await api.readAllNotifications()
            await client.invalidateQueries({ queryKey: ['notifications'] })
          }}
        >
          Mark all read
        </Button>
      </div>
      {query.isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : query.isError ? (
        <ErrorState message="Notifications could not be loaded." onRetry={() => query.refetch()} />
      ) : !query.data?.items.length ? (
        <EmptyState icon={<Bell className="size-4" />} title="You're caught up" body="Assignments, reviews, and deadline reminders will land here." />
      ) : (
        <Card className="divide-y divide-[#E2E8F0]">
          {query.data.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => open(item.id, item.taskId, item.read)}
              className={cn('flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-[#F8FAFC]', !item.read && 'bg-[#EFF6FF]/50')}
            >
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-[#2563EB]')} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[#0F172A]">{item.title}</span>
                <span className="mt-0.5 block text-sm text-[#64748B]">{item.body}</span>
                <span className="mt-1 block text-xs text-[#94A3B8]">{relativeTime(item.createdAt)}</span>
              </span>
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
