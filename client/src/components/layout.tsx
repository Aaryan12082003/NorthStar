import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { roleLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth'
import { Avatar } from './common'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'

type Meta = { title: string; crumbs: string[] }
const MetaValueContext = createContext<Meta>({ title: 'Dashboard', crumbs: ['Northstar'] })
const SetMetaContext = createContext<(meta: Meta) => void>(() => {})
const ShellContext = createContext<{ openTask: () => void; collapsed: boolean } | null>(null)

export function usePage(title: string, crumbs: string[]) {
  const setMeta = useContext(SetMetaContext)
  const key = crumbs.join('|')
  useEffect(() => {
    setMeta({ title, crumbs })
    document.title = `${title} · Northstar`
  }, [setMeta, title, key])
}

export function useCreateTask() {
  return useContext(ShellContext)
}

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/my-tasks', label: 'My Tasks', icon: ListChecks },
  { to: '/tasks', label: 'All Tasks', icon: ListTodo },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/team', label: 'Team Members', icon: Users },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppShell({ children, onCreate }: { children: ReactNode; onCreate: () => void }) {
  const { user, workspace, logout } = useAuth()
  const navigate = useNavigate()
  const [meta, setMeta] = useState<Meta>({ title: 'Dashboard', crumbs: ['Northstar'] })
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('ns-sidebar') === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const shell = useMemo(() => ({ openTask: onCreate, collapsed }), [onCreate, collapsed])

  useEffect(() => {
    localStorage.setItem('ns-sidebar', collapsed ? '1' : '0')
  }, [collapsed])

  if (!user || !workspace) return null

  return (
    <SetMetaContext.Provider value={setMeta}>
      <MetaValueContext.Provider value={meta}>
      <ShellContext.Provider value={shell}>
        <div className="min-h-screen bg-[#F8FAFC]" style={{ ['--sidebar' as string]: collapsed ? '76px' : '248px' }}>
          {mobileOpen && <button className="fixed inset-0 z-30 bg-[#0F172A]/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#E2E8F0] bg-white transition-transform duration-200 lg:w-[var(--sidebar)] lg:translate-x-0',
              mobileOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="flex h-16 items-center gap-3 px-4">
              <Link to="/" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#2563EB] text-white">
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                  <path fill="currentColor" d="M12 2.2l1.7 5.2h5.5l-4.4 3.2 1.7 5.2L12 12.6 7.5 15.8l1.7-5.2L4.8 7.4h5.5L12 2.2z" />
                </svg>
              </Link>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0F172A]">{workspace.name}</p>
                  <p className="truncate text-xs text-[#64748B]">Product workspace</p>
                </div>
              )}
              <button className="ml-auto text-[#64748B] lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close sidebar">
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]',
                      isActive && 'bg-[#EFF6FF] font-medium text-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#2563EB]',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <item.icon className="size-[18px] shrink-0" />
                  {!collapsed && item.label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-[#E2E8F0] p-3">
              <button
                className="mb-2 hidden h-8 w-full items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC] lg:flex"
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger className={cn('flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-[#F8FAFC]', collapsed && 'justify-center')}>
                  <Avatar name={user.name} color={user.avatarColor} />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[#0F172A]">{user.name}</span>
                        <span className="block truncate text-xs text-[#64748B]">{roleLabel[user.role]}</span>
                      </span>
                      <ChevronDown className="size-4 text-[#94A3B8]" />
                    </>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => navigate(`/team/${user.id}`)}>View profile</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/settings')}>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => logout()}>
                    <LogOut className="size-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </aside>
          <div className="lg:pl-[var(--sidebar)]">
            <Header onMenu={() => setMobileOpen(true)} onCreate={onCreate} />
            <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </ShellContext.Provider>
      </MetaValueContext.Provider>
    </SetMetaContext.Provider>
  )
}

function Header({ onMenu, onCreate }: { onMenu: () => void; onCreate: () => void }) {
  const meta = useContext(MetaValueContext)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const notifications = useQuery({ queryKey: ['notifications'], queryFn: api.notifications })
  const search = useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), enabled: q.trim().length >= 2 })
  const canCreate = user?.role !== 'EMPLOYEE'

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.getElementById('global-search')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:px-8">
      <button className="text-[#64748B] lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      <div className="min-w-0 flex-1 lg:flex-none">
        <p className="truncate text-xs text-[#64748B]">{meta.crumbs.join(' / ')}</p>
        <h1 className="truncate text-[15px] font-semibold text-[#0F172A]">{meta.title}</h1>
      </div>
      <div className="relative ml-auto hidden w-[320px] md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
        <input
          id="global-search"
          value={q}
          onChange={(event) => {
            setQ(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search tasks, projects, people"
          className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] pl-9 pr-12 text-sm outline-none focus:border-[#2563EB] focus:bg-white"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[#E2E8F0] px-1.5 text-[10px] text-[#94A3B8]">⌘K</span>
        {open && q.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
            <SearchGroup label="Tasks" empty="No matching tasks">
              {search.data?.tasks.map((task) => (
                <button key={task.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#F8FAFC]" onMouseDown={() => navigate(`/tasks/${task.id}`)}>
                  <span className="font-medium text-[#0F172A]">{task.title}</span>
                  <span className="ml-2 text-xs text-[#64748B]">{task.project}</span>
                </button>
              ))}
            </SearchGroup>
            <SearchGroup label="Projects">
              {search.data?.projects.map((project) => (
                <button key={project.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#F8FAFC]" onMouseDown={() => navigate(`/projects/${project.id}`)}>
                  {project.name}
                </button>
              ))}
            </SearchGroup>
            <SearchGroup label="People">
              {search.data?.members.map((member) => (
                <button key={member.id} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F8FAFC]" onMouseDown={() => navigate(`/team/${member.id}`)}>
                  <Avatar name={member.name} color={member.avatarColor} className="size-6 text-[10px]" />
                  <span>{member.name}</span>
                  <span className="text-xs text-[#64748B]">{member.title}</span>
                </button>
              ))}
            </SearchGroup>
          </div>
        )}
      </div>
      {canCreate && (
        <Button onClick={onCreate} className="hidden sm:inline-flex">
          <Plus className="size-4" /> Create Task
        </Button>
      )}
      {canCreate && (
        <Button onClick={onCreate} size="icon" className="sm:hidden" aria-label="Create task">
          <Plus className="size-4" />
        </Button>
      )}
      <button className="relative grid size-9 place-items-center rounded-lg text-[#64748B] hover:bg-[#F8FAFC]" onClick={() => navigate('/notifications')} aria-label="Notifications">
        <Bell className="size-[18px]" />
        {(notifications.data?.unreadCount || 0) > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-[#EF4444] px-1 text-[10px] font-semibold text-white">
            {notifications.data!.unreadCount}
          </span>
        )}
      </button>
      {user && <Avatar name={user.name} color={user.avatarColor} className="size-8" />}
    </header>
  )
}

function SearchGroup({ label, children, empty }: { label: string; children: ReactNode; empty?: string }) {
  const items = Array.isArray(children) ? children : [children]
  const present = items.some(Boolean)
  return (
    <div className="border-b border-[#E2E8F0] py-1 last:border-0">
      <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">{label}</p>
      {present ? children : <p className="px-3 py-2 text-sm text-[#94A3B8]">{empty || 'Nothing here'}</p>}
    </div>
  )
}
