import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import multer from 'multer'
import { createReadStream, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { clearSessionCookie, getAuthByToken, openSession, publicUser, readAuth, requireAuth, revokeSession, setSessionCookie, verifyPassword, writeAudit } from './lib/auth.ts'
import {
  addComment,
  buildReport,
  createMember,
  createProject,
  createTask,
  dashboard,
  getMember,
  getProject,
  getTask,
  listActivity,
  listMembers,
  listNotifications,
  listProjects,
  listTasks,
  markAllNotifications,
  markNotification,
  readAttachment,
  removeAttachment,
  removeMember,
  removeProject,
  removeTask,
  renameWorkspace,
  reviewTask,
  saveAttachment,
  searchWorkspace,
  setSubtask,
  transitionTask,
  updateMember,
  updateProfile,
  updateProject,
  updateTask,
} from './lib/domain.ts'
import { asyncRoute, clientIp, HttpError, parse } from './lib/http.ts'
import { db } from './prisma/db.ts'

const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')
mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    cb(null, `${Date.now()}-${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('text/') ||
      ['application/pdf', 'application/zip', 'application/json', 'application/msword', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.mimetype)
    cb(null, allowed)
  },
})

const timestamp = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date.')
const role = z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE'])
const priority = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW'])
const status = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'ARCHIVED'])
const projectStatus = z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'])

const taskSchema = z.object({
  title: z.string().trim().min(2, 'Give the task a title.').max(160),
  description: z.string().trim().max(8000).optional(),
  projectId: z.string().min(1, 'Choose a project.'),
  assigneeIds: z.array(z.string()).min(1, 'Assign at least one person.'),
  priority,
  status: status.optional(),
  startDate: timestamp.nullable().optional(),
  deadline: timestamp.nullable().optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
  subtasks: z.array(z.object({ title: z.string().trim().min(1).max(200), done: z.boolean().optional() })).max(30).optional(),
  recurrence: z.object({
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    interval: z.number().int().min(1).max(30),
  }).nullable().optional(),
})

const projectSchema = z.object({
  name: z.string().trim().min(2, 'Name the project.').max(120),
  description: z.string().trim().max(4000).optional(),
  ownerId: z.string().min(1),
  memberIds: z.array(z.string()).default([]),
  status: projectStatus.optional(),
  startDate: timestamp.nullable().optional(),
  deadline: timestamp.nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }))

  const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false })

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.post('/api/auth/login', loginLimit, asyncRoute(async (req, res) => {
    const body = parse(z.object({
      email: z.string().trim().email('Enter a valid email.'),
      password: z.string().min(1, 'Enter your password.'),
    }), req.body)
    const user = await db.orm.public.User.where({ email: body.email.toLowerCase() }).first()
    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false
    if (!user || !valid) {
      await writeAudit({ action: 'auth.login_failed', ip: clientIp(req), detail: body.email.toLowerCase() })
      throw new HttpError(401, 'Email or password is incorrect.')
    }
    const membership = await db.orm.public.WorkspaceMember.where({ userId: user.id }).first()
    if (!membership) throw new HttpError(403, 'You are not part of a workspace.')
    const token = await openSession(user.id)
    setSessionCookie(res, token)
    await writeAudit({ userId: user.id, workspaceId: membership.workspaceId, action: 'auth.login', ip: clientIp(req) })
    const auth = await getAuthByToken(token)
    res.json({ user: auth ? publicUser(auth) : null, workspace: auth ? { id: auth.workspaceId, name: auth.workspaceName, slug: auth.workspaceSlug } : null })
  }))

  app.post('/api/auth/logout', asyncRoute(async (req, res) => {
    const auth = await readAuth(req)
    await revokeSession(typeof req.cookies?.ns_session === 'string' ? req.cookies.ns_session : null)
    clearSessionCookie(res)
    if (auth) await writeAudit({ userId: auth.user.id, workspaceId: auth.workspaceId, action: 'auth.logout', ip: clientIp(req) })
    res.json({ ok: true })
  }))

  app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
    const auth = req.auth!
    res.json({
      user: publicUser(auth),
      workspace: { id: auth.workspaceId, name: auth.workspaceName, slug: auth.workspaceSlug },
    })
  }))

  app.patch('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(z.object({
      name: z.string().trim().min(2).max(80).optional(),
      title: z.string().trim().min(2).max(80).optional(),
      timezone: z.string().trim().min(1).max(80).optional(),
      preferences: z.object({
        notifyAssigned: z.boolean().optional(),
        notifyDueSoon: z.boolean().optional(),
        notifyDueToday: z.boolean().optional(),
        notifyOverdue: z.boolean().optional(),
        notifyReview: z.boolean().optional(),
        notifyChanges: z.boolean().optional(),
      }).optional(),
    }), req.body)
    const profile = await updateProfile(req.auth!, body)
    res.json(profile)
  }))

  app.patch('/api/workspace', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(z.object({ name: z.string().trim().min(2).max(80) }), req.body)
    res.json(await renameWorkspace(req.auth!, body.name))
  }))

  app.get('/api/dashboard', requireAuth, asyncRoute(async (req, res) => {
    res.json(await dashboard(req.auth!))
  }))

  app.get('/api/search', requireAuth, asyncRoute(async (req, res) => {
    const q = String(req.query.q || '').trim()
    if (q.length < 2) {
      res.json({ tasks: [], projects: [], members: [] })
      return
    }
    res.json(await searchWorkspace(req.auth!, q))
  }))

  app.get('/api/activity', requireAuth, asyncRoute(async (req, res) => {
    res.json(await listActivity(req.auth!))
  }))

  app.get('/api/tasks', requireAuth, asyncRoute(async (req, res) => {
    res.json(await listTasks(req.auth!, {
      q: optionalString(req.query.q),
      status: optionalString(req.query.status),
      priority: optionalString(req.query.priority),
      projectId: optionalString(req.query.projectId),
      assigneeId: optionalString(req.query.assigneeId),
      overdue: req.query.overdue === '1',
      mine: req.query.mine === '1',
      from: optionalString(req.query.from),
      to: optionalString(req.query.to),
      sort: optionalString(req.query.sort),
      dir: req.query.dir === 'desc' ? 'desc' : 'asc',
      page: numberQuery(req.query.page, 1),
      pageSize: numberQuery(req.query.pageSize, 10),
    }))
  }))

  app.post('/api/tasks', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(taskSchema, req.body)
    if (!body.deadline) throw new HttpError(400, 'Add a deadline.', [{ path: 'deadline', message: 'Add a deadline.' }])
    res.status(201).json(await createTask(req.auth!, { ...body, deadline: body.deadline }))
  }))

  app.get('/api/tasks/:id', requireAuth, asyncRoute(async (req, res) => {
    res.json(await getTask(req.auth!, idOf(req.params.id)))
  }))

  app.patch('/api/tasks/:id', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(taskSchema.partial(), req.body)
    res.json(await updateTask(req.auth!, idOf(req.params.id), body))
  }))

  app.delete('/api/tasks/:id', requireAuth, asyncRoute(async (req, res) => {
    await removeTask(req.auth!, idOf(req.params.id))
    await writeAudit({ userId: req.auth!.user.id, workspaceId: req.auth!.workspaceId, action: 'task.delete', ip: clientIp(req), detail: idOf(req.params.id) })
    res.json({ ok: true })
  }))

  app.post('/api/tasks/:id/transition', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(z.object({ status }), req.body)
    res.json(await transitionTask(req.auth!, idOf(req.params.id), body.status))
  }))

  app.post('/api/tasks/:id/review', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(z.object({
      action: z.enum(['approve', 'return']),
      note: z.string().trim().max(1000).optional(),
    }), req.body)
    res.json(await reviewTask(req.auth!, idOf(req.params.id), body.action, body.note || ''))
  }))

  app.post('/api/tasks/:id/comments', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(z.object({ body: z.string().trim().min(1, 'Write a comment.').max(4000) }), req.body)
    res.status(201).json(await addComment(req.auth!, idOf(req.params.id), body.body))
  }))

  app.patch('/api/subtasks/:id', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(z.object({ done: z.boolean() }), req.body)
    res.json(await setSubtask(req.auth!, idOf(req.params.id), body.done))
  }))

  app.post('/api/tasks/:id/attachments', requireAuth, upload.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose a file to upload. Images, PDFs, and documents are supported.')
    await saveAttachment(req.auth!, idOf(req.params.id), {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    })
    res.status(201).json(await getTask(req.auth!, idOf(req.params.id)))
  }))

  app.get('/api/attachments/:id', requireAuth, asyncRoute(async (req, res) => {
    const row = await readAttachment(req.auth!, idOf(req.params.id))
    const full = path.join(uploadDir, row.filename)
    if (!existsSync(full)) throw new HttpError(404, 'That file is no longer available.')
    res.setHeader('Content-Type', row.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.originalName)}"`)
    createReadStream(full).pipe(res)
  }))

  app.delete('/api/attachments/:id', requireAuth, asyncRoute(async (req, res) => {
    const row = await removeAttachment(req.auth!, idOf(req.params.id))
    res.json({ ok: true, filename: row.filename })
  }))

  app.get('/api/projects', requireAuth, asyncRoute(async (req, res) => {
    res.json(await listProjects(req.auth!))
  }))

  app.post('/api/projects', requireAuth, asyncRoute(async (req, res) => {
    res.status(201).json(await createProject(req.auth!, parse(projectSchema, req.body)))
  }))

  app.get('/api/projects/:id', requireAuth, asyncRoute(async (req, res) => {
    res.json(await getProject(req.auth!, idOf(req.params.id)))
  }))

  app.patch('/api/projects/:id', requireAuth, asyncRoute(async (req, res) => {
    res.json(await updateProject(req.auth!, idOf(req.params.id), parse(projectSchema.partial(), req.body)))
  }))

  app.delete('/api/projects/:id', requireAuth, asyncRoute(async (req, res) => {
    await removeProject(req.auth!, idOf(req.params.id))
    res.json({ ok: true })
  }))

  app.get('/api/members', requireAuth, asyncRoute(async (req, res) => {
    res.json(await listMembers(req.auth!))
  }))

  app.post('/api/members', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email(),
      title: z.string().trim().min(2).max(80),
      role,
      password: z.string().min(8, 'Use at least 8 characters.'),
    }), req.body)
    const member = await createMember(req.auth!, body)
    await writeAudit({ userId: req.auth!.user.id, workspaceId: req.auth!.workspaceId, action: 'member.create', ip: clientIp(req), detail: body.email })
    res.status(201).json(member)
  }))

  app.get('/api/members/:id', requireAuth, asyncRoute(async (req, res) => {
    res.json(await getMember(req.auth!, idOf(req.params.id)))
  }))

  app.patch('/api/members/:id', requireAuth, asyncRoute(async (req, res) => {
    const body = parse(z.object({ role }), req.body)
    const member = await updateMember(req.auth!, idOf(req.params.id), body.role)
    await writeAudit({ userId: req.auth!.user.id, workspaceId: req.auth!.workspaceId, action: 'member.role', ip: clientIp(req), detail: `${idOf(req.params.id)}:${body.role}` })
    res.json(member)
  }))

  app.delete('/api/members/:id', requireAuth, asyncRoute(async (req, res) => {
    await removeMember(req.auth!, idOf(req.params.id))
    await writeAudit({ userId: req.auth!.user.id, workspaceId: req.auth!.workspaceId, action: 'member.remove', ip: clientIp(req), detail: idOf(req.params.id) })
    res.json({ ok: true })
  }))

  app.get('/api/notifications', requireAuth, asyncRoute(async (req, res) => {
    res.json(await listNotifications(req.auth!))
  }))

  app.post('/api/notifications/read-all', requireAuth, asyncRoute(async (req, res) => {
    await markAllNotifications(req.auth!)
    res.json(await listNotifications(req.auth!))
  }))

  app.post('/api/notifications/:id/read', requireAuth, asyncRoute(async (req, res) => {
    await markNotification(req.auth!, idOf(req.params.id))
    res.json(await listNotifications(req.auth!))
  }))

  app.get('/api/reports', requireAuth, asyncRoute(async (req, res) => {
    const range = reportRange(req)
    res.json(await buildReport(req.auth!, range.from, range.to))
  }))

  app.get('/api/reports/export', requireAuth, asyncRoute(async (req, res) => {
    const range = reportRange(req)
    const report = await buildReport(req.auth!, range.from, range.to)
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv'
    if (format === 'csv') {
      const lines = [
        ['Employee', 'Completed', 'On-time rate', 'Average hours', 'Overdue', 'Productivity score'],
        ...report.completedByEmployee.map((row) => [
          row.name,
          String(row.completed),
          row.onTimeRate === null ? '' : `${row.onTimeRate}%`,
          row.avgDurationHours === null ? '' : String(row.avgDurationHours),
          String(row.overdue),
          String(row.score),
        ]),
      ]
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="northstar-report.csv"')
      res.send(`\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\n')}`)
      return
    }
    const excelModule = await import('exceljs')
    const ExcelJS = excelModule.default ?? excelModule
    const workbook = new ExcelJS.Workbook()
    const summary = workbook.addWorksheet('Summary')
    summary.addRows([
      ['From', range.from],
      ['To', range.to],
      ['On-time completion', report.onTimePercentage === null ? 'n/a' : `${report.onTimePercentage}%`],
      ['Average completion hours', report.averageCompletionHours ?? 'n/a'],
    ])
    const people = workbook.addWorksheet('Employees')
    people.addRow(['Employee', 'Title', 'Completed', 'On-time rate', 'Average hours', 'Overdue', 'Score'])
    for (const row of report.completedByEmployee) {
      people.addRow([row.name, row.title, row.completed, row.onTimeRate, row.avgDurationHours, row.overdue, row.score])
    }
    const projects = workbook.addWorksheet('Overdue by project')
    projects.addRow(['Project', 'Overdue tasks'])
    for (const row of report.overdueByProject) projects.addRow([row.name, row.overdue])
    const trends = workbook.addWorksheet('Weekly trend')
    trends.addRow(['Week', 'Created', 'Completed'])
    for (const row of report.weekly) trends.addRow([row.week, row.created, row.completed])
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="northstar-report.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  }))

  const clientDist = process.env.CLIENT_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
  if (process.env.NODE_ENV === 'production' && existsSync(clientDist)) {
    app.use(express.static(clientDist))
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found.' })
  })

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message, issues: error.issues })
      return
    }
    if (error instanceof multer.MulterError) {
      res.status(400).json({ error: 'That file is too large. The limit is 8 MB.', issues: [] })
      return
    }
    console.error(error)
    res.status(500).json({ error: 'Something went wrong. Try again.', issues: [] })
  })

  return app
}

function idOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.length ? value : undefined
}

function numberQuery(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function reportRange(req: express.Request) {
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date()
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : new Date(to.getTime() - 30 * 86_400_000)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new HttpError(400, 'Choose a valid date range.')
  return { from: from.toISOString(), to: to.toISOString() }
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
