import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { usePage } from '@/components/layout'
import { Avatar, Card, EmptyState, ErrorState, RoleBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldError, Input, Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, ApiError } from '@/lib/api'
import { roleLabel } from '@/lib/format'
import type { Role } from '@/lib/types'
import { useAuth } from '@/providers/auth'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(80),
  email: z.string().trim().email('Enter a valid email.'),
  title: z.string().trim().min(2, 'Enter a title.').max(80),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']),
  password: z.string().min(8, 'Use at least 8 characters.'),
})

type Values = z.infer<typeof schema>

export function TeamPage() {
  const { user, workspace } = useAuth()
  usePage('Team Members', [workspace?.name || 'Northstar', 'Team'])
  const query = useQuery({ queryKey: ['members'], queryFn: api.members })
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const isAdmin = user?.role === 'ADMIN'

  const changeRole = async (id: string, role: Role) => {
    try {
      await api.updateMember(id, role)
      await client.invalidateQueries({ queryKey: ['members'] })
      toast.success('Role updated')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The role could not be changed.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isAdmin && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add member
          </Button>
        )}
      </div>
      {query.isLoading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : query.isError ? (
        <ErrorState message="The team could not be loaded." onRetry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <EmptyState icon={<Users className="size-4" />} title="No teammates" body="Add the people who will own the work." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-left text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Assigned</th>
                  <th className="px-4 py-3 font-medium">Completed</th>
                  <th className="px-4 py-3 font-medium">Overdue</th>
                  {isAdmin && <th className="px-4 py-3 font-medium"> </th>}
                </tr>
              </thead>
              <tbody>
                {query.data.map((member) => (
                  <tr key={member.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <Link to={`/team/${member.id}`} className="flex items-center gap-2.5">
                        <Avatar name={member.name} color={member.avatarColor} />
                        <span>
                          <span className="block font-medium text-[#0F172A]">{member.name}</span>
                          <span className="block text-xs text-[#64748B]">{member.title}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && member.id !== user?.id ? (
                        <Select value={member.role} onValueChange={(role) => changeRole(member.id, role as Role)}>
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#0F172A]">{member.assigned}</td>
                    <td className="px-4 py-3 text-[#0F172A]">{member.completed}</td>
                    <td className={`px-4 py-3 ${member.overdue ? 'font-medium text-[#EF4444]' : 'text-[#0F172A]'}`}>{member.overdue}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <Link to={`/team/${member.id}`} className="text-sm font-medium text-[#2563EB]">Profile</Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {isAdmin && <InviteDialog open={open} onOpenChange={setOpen} />}
    </div>
  )
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const client = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', title: '', role: 'EMPLOYEE', password: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await api.createMember(values)
      toast.success('Member added')
      await client.invalidateQueries({ queryKey: ['members'] })
      form.reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'The member could not be added.')
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a teammate</DialogTitle>
          <DialogDescription>They can sign in with this email and password.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="member-name">Name</Label>
            <Input id="member-name" {...form.register('name')} />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="member-email">Email</Label>
            <Input id="member-email" type="email" {...form.register('email')} />
            <FieldError message={form.formState.errors.email?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="member-title">Title</Label>
            <Input id="member-title" {...form.register('title')} />
            <FieldError message={form.formState.errors.title?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={form.watch('role')} onValueChange={(role) => form.setValue('role', role as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="member-password">Temporary password</Label>
            <Input id="member-password" type="text" {...form.register('password')} />
            <FieldError message={form.formState.errors.password?.message} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>Add member</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
