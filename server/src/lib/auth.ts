import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'node:crypto'
import type { Request, Response } from 'express'
import { db } from '../prisma/db.ts'
import { HttpError } from './http.ts'

const COOKIE = 'ns_session'
const SESSION_MS = 14 * 24 * 60 * 60 * 1000

export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'

export type AuthContext = {
  user: {
    id: string
    email: string
    name: string
    title: string
    timezone: string
    avatarColor: string
    notifyAssigned: boolean
    notifyDueSoon: boolean
    notifyDueToday: boolean
    notifyOverdue: boolean
    notifyReview: boolean
    notifyChanges: boolean
  }
  role: Role
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash)
}

export function publicUser(ctx: AuthContext) {
  return {
    ...ctx.user,
    role: ctx.role,
    preferences: {
      notifyAssigned: ctx.user.notifyAssigned,
      notifyDueSoon: ctx.user.notifyDueSoon,
      notifyDueToday: ctx.user.notifyDueToday,
      notifyOverdue: ctx.user.notifyOverdue,
      notifyReview: ctx.user.notifyReview,
      notifyChanges: ctx.user.notifyChanges,
    },
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MS,
    path: '/',
  })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE, { path: '/' })
}

function tokenFromCookieHeader(header: string | undefined) {
  if (!header) return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === COOKIE) return decodeURIComponent(rest.join('='))
  }
  return null
}

export async function getAuthByToken(token: string | null): Promise<AuthContext | null> {
  if (!token) return null
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const session = await db.orm.public.Session.where({ tokenHash })
    .where((row) => row.expiresAt.gt(new Date().toISOString()))
    .include('user')
    .first()
  if (!session) return null
  const membership = await db.orm.public.WorkspaceMember.where({ userId: session.userId })
    .include('workspace')
    .first()
  if (!membership) return null
  const user = session.user
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      title: user.title,
      timezone: user.timezone,
      avatarColor: user.avatarColor,
      notifyAssigned: user.notifyAssigned,
      notifyDueSoon: user.notifyDueSoon,
      notifyDueToday: user.notifyDueToday,
      notifyOverdue: user.notifyOverdue,
      notifyReview: user.notifyReview,
      notifyChanges: user.notifyChanges,
    },
    role: membership.role,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
  }
}

export async function readAuth(req: Request) {
  const cookieToken = req.cookies?.[COOKIE]
  const token = typeof cookieToken === 'string' ? cookieToken : tokenFromCookieHeader(req.headers.cookie)
  return getAuthByToken(token)
}

export async function requireAuth(req: Request, _res: Response, next: (error?: unknown) => void) {
  try {
    const auth = await readAuth(req)
    if (!auth) throw new HttpError(401, 'Sign in to continue.')
    req.auth = auth
    next()
  } catch (error) {
    next(error)
  }
}

export function assertRole(auth: AuthContext, roles: Role[]) {
  if (!roles.includes(auth.role)) throw new HttpError(403, 'You do not have access to that.')
}

export async function openSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db.orm.public.Session.create({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + SESSION_MS).toISOString(),
  })
  return token
}

export async function revokeSession(token: string | null) {
  if (!token) return
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await db.orm.public.Session.where({ tokenHash }).delete()
}

export async function writeAudit(input: {
  workspaceId?: string | null
  userId?: string | null
  action: string
  ip?: string
  detail?: string
}) {
  await db.orm.public.AuditLog.create({
    workspaceId: input.workspaceId ?? null,
    userId: input.userId ?? null,
    action: input.action,
    ip: input.ip || '',
    detail: input.detail || '',
  })
}
