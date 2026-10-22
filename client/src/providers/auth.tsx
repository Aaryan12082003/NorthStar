import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { io } from 'socket.io-client'
import { api, ApiError } from '@/lib/api'
import type { SessionUser, Workspace } from '@/lib/types'

type AuthValue = {
  user: SessionUser | null
  workspace: Workspace | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    retry: false,
  })
  const user = query.data?.user ?? null
  const workspace = query.data?.workspace ?? null

  useEffect(() => {
    if (!user) return
    const socket = io({ withCredentials: true, path: '/socket.io' })
    const refreshTasks = () => {
      client.invalidateQueries({ queryKey: ['tasks'] })
      client.invalidateQueries({ queryKey: ['task'] })
      client.invalidateQueries({ queryKey: ['dashboard'] })
      client.invalidateQueries({ queryKey: ['projects'] })
      client.invalidateQueries({ queryKey: ['project'] })
      client.invalidateQueries({ queryKey: ['members'] })
      client.invalidateQueries({ queryKey: ['member'] })
    }
    socket.on('tasks:changed', refreshTasks)
    socket.on('projects:changed', refreshTasks)
    socket.on('notification:created', () => client.invalidateQueries({ queryKey: ['notifications'] }))
    return () => {
      socket.close()
    }
  }, [user, client])

  const logout = async () => {
    await api.logout()
    client.clear()
    await client.invalidateQueries({ queryKey: ['me'] })
  }

  return (
    <AuthContext.Provider value={{ user, workspace, loading: query.isLoading, logout }}>
      {children}
      {query.error instanceof ApiError && query.error.status !== 401 ? null : null}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is missing')
  return value
}
