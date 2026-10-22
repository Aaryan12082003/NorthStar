import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FieldError, Input, Label } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api'

const schema = z.object({
  email: z.string().trim().email('Enter a valid work email.'),
  password: z.string().min(1, 'Enter your password.'),
})

type Values = z.infer<typeof schema>

const demos = [
  { email: 'ananya@northstar.dev', role: 'Admin' },
  { email: 'rahul@northstar.dev', role: 'Manager' },
  { email: 'priya@northstar.dev', role: 'Employee' },
]

export function LoginPage() {
  const client = useQueryClient()
  const [formError, setFormError] = useState('')
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: 'ananya@northstar.dev', password: 'Northstar123!' },
  })

  const submit = form.handleSubmit(async (values) => {
    setFormError('')
    try {
      await api.login(values.email, values.password)
      await client.invalidateQueries({ queryKey: ['me'] })
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Sign-in did not complete.')
    }
  })

  return (
    <div className="grid min-h-screen bg-[#F8FAFC] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between border-r border-[#E2E8F0] bg-white px-12 py-10 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#2563EB] text-white">
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path fill="currentColor" d="M12 2.2l1.7 5.2h5.5l-4.4 3.2 1.7 5.2L12 12.6 7.5 15.8l1.7-5.2L4.8 7.4h5.5L12 2.2z" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-[#0F172A]">Northstar</span>
        </div>
        <div className="max-w-md">
          <p className="text-sm font-medium text-[#2563EB]">Product workspace</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#0F172A]">A quiet place to see the work, the owners, and the deadlines.</h1>
          <p className="mt-4 text-base leading-7 text-[#64748B]">
            Projects, reviews, and reminders live in one workspace. Everyone sees the tasks they own. Managers see the team.
          </p>
        </div>
        <p className="text-sm text-[#94A3B8]">Shared password for the demo workspace: Northstar123!</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-card">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-[#2563EB] text-white">
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                <path fill="currentColor" d="M12 2.2l1.7 5.2h5.5l-4.4 3.2 1.7 5.2L12 12.6 7.5 15.8l1.7-5.2L4.8 7.4h5.5L12 2.2z" />
              </svg>
            </span>
            <span className="text-sm font-semibold">Northstar</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-[#0F172A]">Sign in</h2>
          <p className="mt-1 text-sm text-[#64748B]">Use your Northstar workspace email.</p>
          <div className="mt-6 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" {...form.register('email')} />
              <FieldError message={form.formState.errors.email?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
              <FieldError message={form.formState.errors.password?.message} />
            </div>
            {formError && <p className="text-sm text-[#EF4444]">{formError}</p>}
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
              {form.formState.isSubmitting ? 'Signing in…' : 'Continue'}
            </Button>
          </div>
          <div className="mt-6 border-t border-[#E2E8F0] pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">Demo accounts</p>
            <div className="mt-2 grid gap-1.5">
              {demos.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#F8FAFC]"
                  onClick={() => {
                    form.setValue('email', demo.email)
                    form.setValue('password', 'Northstar123!')
                  }}
                >
                  <span className="text-[#0F172A]">{demo.email}</span>
                  <span className="text-xs text-[#64748B]">{demo.role}</span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
