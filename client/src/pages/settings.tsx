import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { usePage } from '@/components/layout'
import { Card } from '@/components/common'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { Switch } from '@/components/ui/misc'
import { api, ApiError } from '@/lib/api'
import type { Preferences } from '@/lib/types'
import { useAuth } from '@/providers/auth'

const zones = ['Asia/Kolkata', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC']

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  title: z.string().trim().min(2, 'Enter your title.').max(80),
  timezone: z.string().min(1),
})

const workspaceSchema = z.object({
  name: z.string().trim().min(2, 'Name the workspace.').max(80),
})

const preferenceFields: { key: keyof Preferences; label: string; hint: string }[] = [
  { key: 'notifyAssigned', label: 'Assignments', hint: 'When a task is assigned or reassigned to you.' },
  { key: 'notifyDueSoon', label: 'Coming due', hint: 'Three days before a deadline, and again the day before.' },
  { key: 'notifyDueToday', label: 'Due today', hint: 'A reminder on the morning the work is due.' },
  { key: 'notifyOverdue', label: 'Overdue', hint: 'Once a deadline passes and the task is still open.' },
  { key: 'notifyReview', label: 'Reviews', hint: 'Submissions, approvals, and returned work.' },
  { key: 'notifyChanges', label: 'Changes', hint: 'Deadline updates on tasks you are on.' },
]

export function SettingsPage() {
  const { user, workspace } = useAuth()
  const client = useQueryClient()
  usePage('Settings', [workspace?.name || 'Northstar', 'Settings'])
  const profile = useForm({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name || '', title: user?.title || '', timezone: user?.timezone || 'Asia/Kolkata' },
  })
  const workspaceForm = useForm({
    resolver: zodResolver(workspaceSchema),
    values: { name: workspace?.name || '' },
  })

  if (!user || !workspace) return null

  const saveProfile = profile.handleSubmit(async (values) => {
    try {
      await api.updateMe(values)
      await client.invalidateQueries({ queryKey: ['me'] })
      toast.success('Profile saved')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The profile could not be saved.')
    }
  })

  const saveWorkspace = workspaceForm.handleSubmit(async (values) => {
    try {
      await api.renameWorkspace(values.name)
      await client.invalidateQueries({ queryKey: ['me'] })
      toast.success('Workspace renamed')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The workspace could not be renamed.')
    }
  })

  const toggle = async (key: keyof Preferences, value: boolean) => {
    try {
      await api.updateMe({ preferences: { [key]: value } })
      await client.invalidateQueries({ queryKey: ['me'] })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'That preference could not be saved.')
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Card className="p-6">
        <h2 className="text-base font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-[#64748B]">Deadlines and reminders use this time zone.</p>
        <form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...profile.register('name')} />
            <FieldError message={profile.formState.errors.name?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...profile.register('title')} />
            <FieldError message={profile.formState.errors.title?.message} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="timezone">Time zone</Label>
            <select id="timezone" className="h-9 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm" {...profile.register('timezone')}>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              {!zones.includes(user.timezone) && <option value={user.timezone}>{user.timezone}</option>}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={profile.formState.isSubmitting}>Save profile</Button>
          </div>
        </form>
      </Card>
      <Card className="p-6">
        <h2 className="text-base font-semibold">Notifications</h2>
        <p className="mt-1 text-sm text-[#64748B]">Reminders are sent by a background job, even when this tab is closed.</p>
        <ul className="mt-4 divide-y divide-[#E2E8F0]">
          {preferenceFields.map((field) => (
            <li key={field.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{field.label}</p>
                <p className="text-xs text-[#64748B]">{field.hint}</p>
              </div>
              <Switch checked={user.preferences[field.key]} onCheckedChange={(checked) => toggle(field.key, checked)} aria-label={field.label} />
            </li>
          ))}
        </ul>
      </Card>
      {user.role === 'ADMIN' && (
        <Card className="p-6">
          <h2 className="text-base font-semibold">Workspace</h2>
          <form onSubmit={saveWorkspace} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="workspace">Name</Label>
              <Input id="workspace" {...workspaceForm.register('name')} />
              <FieldError message={workspaceForm.formState.errors.name?.message} />
            </div>
            <Button type="submit" variant="outline" disabled={workspaceForm.formState.isSubmitting}>Rename</Button>
          </form>
        </Card>
      )}
    </div>
  )
}
