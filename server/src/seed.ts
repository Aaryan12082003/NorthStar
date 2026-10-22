import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from './lib/auth.ts'
import { logActivity } from './lib/notify.ts'
import { db } from './prisma/db.ts'

const PASSWORD = 'Northstar123!'
const TZ = 'Asia/Kolkata'

const people = [
  { key: 'ananya', name: 'Ananya Iyer', email: 'ananya@northstar.dev', title: 'Head of Product', role: 'ADMIN' as const, color: '#2563EB' },
  { key: 'rahul', name: 'Rahul Mehta', email: 'rahul@northstar.dev', title: 'Engineering Manager', role: 'MANAGER' as const, color: '#8B5CF6' },
  { key: 'priya', name: 'Priya Nair', email: 'priya@northstar.dev', title: 'Product Designer', role: 'EMPLOYEE' as const, color: '#16A34A' },
  { key: 'amit', name: 'Amit Shah', email: 'amit@northstar.dev', title: 'Software Engineer', role: 'EMPLOYEE' as const, color: '#F59E0B' },
  { key: 'kavya', name: 'Kavya Rao', email: 'kavya@northstar.dev', title: 'Customer Success Lead', role: 'MANAGER' as const, color: '#EF4444' },
  { key: 'dev', name: 'Dev Patel', email: 'dev@northstar.dev', title: 'Frontend Engineer', role: 'EMPLOYEE' as const, color: '#0EA5E9' },
  { key: 'meera', name: 'Meera Krishnan', email: 'meera@northstar.dev', title: 'Data Analyst', role: 'EMPLOYEE' as const, color: '#DB2777' },
]

function at(dayOffset: number, hours: number, minutes = 0) {
  const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd')
  const [year, month, day] = today.split('-').map(Number)
  const date = new Date(Date.UTC(year!, (month || 1) - 1, (day || 1) + dayOffset))
  const isoDate = date.toISOString().slice(0, 10)
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  return fromZonedTime(`${isoDate}T${hh}:${mm}:00`, TZ).toISOString()
}

export async function seedDatabase(options: { reset?: boolean } = {}) {
  const existing = await db.orm.public.Workspace.where({ slug: 'northstar' }).first()
  if (existing && !options.reset) return { seeded: false }
  if (existing) {
    await db.orm.public.Workspace.where({ id: existing.id }).delete()
    const users = await db.orm.public.User.where((row) => row.email.ilike('%@northstar.dev')).all()
    for (const user of users) await db.orm.public.User.where({ id: user.id }).delete()
    const audits = await db.orm.public.AuditLog.all()
    for (const audit of audits) await db.orm.public.AuditLog.where({ id: audit.id }).delete()
  }

  const passwordHash = await hashPassword(PASSWORD)
  const ids: Record<string, string> = {}
  for (const person of people) {
    const user = await db.orm.public.User.create({
      email: person.email,
      name: person.name,
      title: person.title,
      passwordHash,
      avatarColor: person.color,
      timezone: TZ,
    })
    ids[person.key] = user.id
  }

  const workspace = await db.orm.public.Workspace.create({ name: 'Northstar', slug: 'northstar' })
  for (const person of people) {
    await db.orm.public.WorkspaceMember.create({ workspaceId: workspace.id, userId: ids[person.key]!, role: person.role })
  }

  const projectDefs = [
    { key: 'web', name: 'Website Redesign', description: 'A calmer marketing site and a clearer path from the homepage into the product.', owner: 'rahul', status: 'ACTIVE' as const, color: '#2563EB', start: -20, end: 18, members: ['rahul', 'priya', 'dev', 'ananya'] },
    { key: 'mobile', name: 'Mobile App Launch', description: 'Ship the Android and iOS release with a stable checkout and store listing.', owner: 'rahul', status: 'ACTIVE' as const, color: '#8B5CF6', start: -14, end: 10, members: ['rahul', 'amit', 'dev', 'priya'] },
    { key: 'success', name: 'Customer Onboarding', description: 'Shorten the time it takes a new account to reach the first meaningful outcome.', owner: 'kavya', status: 'ACTIVE' as const, color: '#16A34A', start: -10, end: 21, members: ['kavya', 'meera', 'ananya'] },
    { key: 'analytics', name: 'Analytics Platform', description: 'Define the metrics the company will actually manage, then instrument them.', owner: 'ananya', status: 'PLANNING' as const, color: '#F59E0B', start: -3, end: 40, members: ['ananya', 'dev', 'amit', 'meera'] },
    { key: 'hiring', name: 'Q4 Hiring', description: 'Close the product and engineering loops without slowing the teams already shipping.', owner: 'ananya', status: 'ON_HOLD' as const, color: '#64748B', start: -30, end: 12, members: ['ananya', 'rahul', 'amit'] },
  ]

  const projects: Record<string, string> = {}
  for (const project of projectDefs) {
    const row = await db.orm.public.Project.create({
      workspaceId: workspace.id,
      name: project.name,
      description: project.description,
      ownerId: ids[project.owner]!,
      status: project.status,
      color: project.color,
      startDate: at(project.start, 10),
      deadline: at(project.end, 18),
    })
    projects[project.key] = row.id
    for (const member of project.members) {
      await db.orm.public.ProjectMember.create({ projectId: row.id, userId: ids[member]! })
    }
  }

  const tags = [
    { name: 'Design', color: '#8B5CF6' },
    { name: 'Engineering', color: '#2563EB' },
    { name: 'Research', color: '#16A34A' },
    { name: 'Launch', color: '#F59E0B' },
    { name: 'Hiring', color: '#64748B' },
  ]
  const tagIds: Record<string, string> = {}
  for (const tag of tags) {
    const row = await db.orm.public.Tag.create({ workspaceId: workspace.id, name: tag.name, color: tag.color })
    tagIds[tag.name] = row.id
  }

  type SeedTask = {
    title: string
    project: string
    assignees: string[]
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'
    status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'ARCHIVED'
    deadline: string
    start?: string
    hours: number
    description: string
    tags: string[]
    subtasks?: string[]
    completedAt?: string
    creator: string
    reviewNote?: string
  }

  const tasks: SeedTask[] = [
    { title: 'Finalize homepage hero', project: 'web', assignees: ['priya'], priority: 'HIGH', status: 'IN_PROGRESS', deadline: at(2, 17), start: at(-2, 10), hours: 6, description: 'Tighten the headline, the product frame, and the first proof point above the fold.', tags: ['Design'], subtasks: ['Pick the headline', 'Export the product frame', 'Check contrast'], creator: 'rahul' },
    { title: 'Audit navigation IA', project: 'web', assignees: ['priya', 'ananya'], priority: 'MEDIUM', status: 'TODO', deadline: at(5, 15), start: at(0, 10), hours: 4, description: 'Compare the current sitemap with what customers search for in support.', tags: ['Research'], creator: 'ananya' },
    { title: 'Design system tokens', project: 'web', assignees: ['dev'], priority: 'MEDIUM', status: 'COMPLETED', deadline: at(-1, 18), start: at(-8, 10), hours: 8, description: 'Color, type, and spacing tokens shared by marketing and the app.', tags: ['Design', 'Engineering'], completedAt: at(-2, 16), creator: 'priya' },
    { title: 'Checkout flow QA', project: 'mobile', assignees: ['amit', 'dev'], priority: 'URGENT', status: 'IN_PROGRESS', deadline: at(0, 18), start: at(-1, 11), hours: 5, description: 'Walk the payment path on a mid-range Android device and the latest iPhone.', tags: ['Launch', 'Engineering'], subtasks: ['Android Pixel pass', 'iOS pass', 'Note declined-card copy'], creator: 'rahul' },
    { title: 'Push notification copy', project: 'mobile', assignees: ['priya'], priority: 'LOW', status: 'TODO', deadline: at(6, 12), hours: 2, description: 'Three variants for the trial reminder. Keep each under 90 characters.', tags: ['Design'], creator: 'kavya' },
    { title: 'App store screenshots', project: 'mobile', assignees: ['dev', 'priya'], priority: 'HIGH', status: 'IN_REVIEW', deadline: at(1, 16), start: at(-4, 10), hours: 7, description: 'Six frames that show the new checkout, not the empty states.', tags: ['Launch', 'Design'], creator: 'rahul' },
    { title: 'Fix login crash on Android', project: 'mobile', assignees: ['amit'], priority: 'URGENT', status: 'TODO', deadline: at(-1, 12), start: at(-3, 10), hours: 4, description: 'The session restore path throws when the refresh token is missing.', tags: ['Engineering'], creator: 'rahul' },
    { title: 'Onboarding email sequence', project: 'success', assignees: ['meera', 'kavya'], priority: 'MEDIUM', status: 'IN_PROGRESS', deadline: at(3, 11), start: at(-2, 10), hours: 5, description: 'Four notes across the first week, each tied to one action in the product.', tags: ['Research'], creator: 'kavya' },
    { title: 'Success metrics dashboard', project: 'success', assignees: ['meera'], priority: 'HIGH', status: 'TODO', deadline: at(1, 17), hours: 6, description: 'Activation, time-to-value, and the accounts that stalled after day three.', tags: ['Research'], creator: 'ananya' },
    { title: 'QBR deck for Acme', project: 'success', assignees: ['kavya'], priority: 'MEDIUM', status: 'COMPLETED', deadline: at(-4, 15), start: at(-9, 10), hours: 3, description: 'A twelve-slide review with the renewal risk called out on one page.', tags: ['Research'], completedAt: at(-2, 19), creator: 'ananya' },
    { title: 'Instrument activation events', project: 'analytics', assignees: ['dev', 'amit'], priority: 'HIGH', status: 'IN_PROGRESS', deadline: at(4, 18), start: at(-1, 10), hours: 10, description: 'Track the first project, the first invite, and the first completed task.', tags: ['Engineering'], creator: 'ananya' },
    { title: 'Define the north-star metric', project: 'analytics', assignees: ['ananya', 'meera'], priority: 'MEDIUM', status: 'TODO', deadline: at(8, 16), hours: 3, description: 'Choose one number the Monday review will open with, and write down what it is not.', tags: ['Research'], creator: 'ananya' },
    { title: 'Pipeline SLA review', project: 'hiring', assignees: ['rahul'], priority: 'LOW', status: 'TODO', deadline: at(-3, 17), hours: 2, description: 'Find the stages where candidates sit longer than five days.', tags: ['Hiring'], creator: 'ananya' },
    { title: 'Write the backend interview loop', project: 'hiring', assignees: ['amit'], priority: 'MEDIUM', status: 'IN_REVIEW', deadline: at(2, 15), start: at(-5, 10), hours: 4, description: 'A practical exercise that can be reviewed in under an hour.', tags: ['Hiring', 'Engineering'], creator: 'rahul' },
    { title: 'Accessibility pass', project: 'web', assignees: ['priya', 'dev'], priority: 'HIGH', status: 'TODO', deadline: at(3, 18), hours: 6, description: 'Keyboard path, focus order, and contrast on the new homepage.', tags: ['Design'], creator: 'rahul' },
    { title: 'Release notes', project: 'mobile', assignees: ['ananya'], priority: 'LOW', status: 'COMPLETED', deadline: at(-6, 12), start: at(-7, 10), hours: 1, description: 'Customer-facing notes for the 2.4 release.', tags: ['Launch'], completedAt: at(-6, 11), creator: 'rahul' },
    { title: 'Customer interview notes', project: 'success', assignees: ['kavya'], priority: 'MEDIUM', status: 'IN_PROGRESS', deadline: at(10, 16), start: at(-1, 14), hours: 3, description: 'Synthesize the five onboarding calls from this week.', tags: ['Research'], creator: 'kavya' },
    { title: 'API rate-limit design', project: 'analytics', assignees: ['amit'], priority: 'HIGH', status: 'TODO', deadline: at(1, 13), hours: 5, description: 'Decide the per-workspace budget and what the client should do when it is exhausted.', tags: ['Engineering'], creator: 'rahul' },
    { title: 'Sprint retro actions', project: 'web', assignees: ['rahul'], priority: 'LOW', status: 'ARCHIVED', deadline: at(-12, 16), hours: 1, description: 'Closed the action list from the last retro.', tags: ['Engineering'], completedAt: at(-11, 17), creator: 'rahul' },
    { title: 'Billing page empty states', project: 'web', assignees: ['dev'], priority: 'MEDIUM', status: 'IN_PROGRESS', deadline: at(1, 19), start: at(-1, 10), hours: 4, description: 'What a brand-new workspace sees before the first invoice.', tags: ['Design', 'Engineering'], creator: 'priya' },
    { title: 'Weekly planning notes', project: 'web', assignees: ['rahul', 'ananya'], priority: 'LOW', status: 'TODO', deadline: at(7, 9, 30), hours: 1, description: 'A standing Monday note so the plan does not live in chat.', tags: ['Engineering'], creator: 'ananya' },
    { title: 'Security review checklist', project: 'mobile', assignees: ['amit'], priority: 'URGENT', status: 'IN_REVIEW', deadline: at(-2, 18), start: at(-6, 10), hours: 6, description: 'Session storage, certificate pinning, and the logout path.', tags: ['Engineering', 'Launch'], reviewNote: '', creator: 'rahul' },
    { title: 'Update the team handbook', project: 'hiring', assignees: ['ananya'], priority: 'LOW', status: 'TODO', deadline: at(14, 17), hours: 2, description: 'How new people get a workspace, a project, and a first task.', tags: ['Hiring'], creator: 'ananya' },
    { title: 'Illustration handoff', project: 'web', assignees: ['priya'], priority: 'MEDIUM', status: 'COMPLETED', deadline: at(-9, 15), start: at(-12, 10), hours: 3, description: 'Source files for the three homepage scenes.', tags: ['Design'], completedAt: at(-8, 14), creator: 'rahul' },
    { title: 'Load test checkout', project: 'mobile', assignees: ['dev'], priority: 'HIGH', status: 'TODO', deadline: at(0, 21), hours: 4, description: 'Confirm the payment service holds up through the launch window.', tags: ['Launch', 'Engineering'], creator: 'amit' },
    { title: 'Churn interview synthesis', project: 'success', assignees: ['meera'], priority: 'MEDIUM', status: 'IN_PROGRESS', deadline: at(-2, 16), start: at(-6, 11), hours: 5, description: 'Group the reasons accounts left in the last quarter.', tags: ['Research'], creator: 'kavya' },
  ]

  const taskIds: string[] = []
  for (const task of tasks) {
    const row = await db.orm.public.Task.create({
      workspaceId: workspace.id,
      projectId: projects[task.project]!,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      startDate: task.start || null,
      deadline: task.deadline,
      estimatedHours: task.hours,
      createdById: ids[task.creator]!,
      completedAt: task.completedAt || null,
      submittedAt: task.status === 'IN_REVIEW' ? at(-1, 11) : null,
      reviewNote: task.reviewNote || '',
    })
    taskIds.push(row.id)
    for (const assignee of task.assignees) await db.orm.public.TaskAssignee.create({ taskId: row.id, userId: ids[assignee]! })
    for (const tag of task.tags) await db.orm.public.TaskTag.create({ taskId: row.id, tagId: tagIds[tag]! })
    for (const [index, title] of (task.subtasks || []).entries()) {
      await db.orm.public.Subtask.create({ taskId: row.id, title, done: task.status === 'COMPLETED', position: index })
    }
  }

  const weekly = await db.orm.public.Task.where({ title: 'Weekly planning notes' }).first()
  if (weekly) {
    await db.orm.public.RecurringTaskRule.create({
      taskId: weekly.id,
      frequency: 'WEEKLY',
      interval: 1,
      nextRunAt: at(0, 9),
      active: true,
    })
  }

  const uploadDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads')
  mkdirSync(uploadDir, { recursive: true })
  const hero = taskIds[0]
  if (hero) {
    const filename = 'homepage-notes.txt'
    writeFileSync(path.join(uploadDir, filename), 'Homepage notes\n\nLead with the outcome, not the feature list.\n')
    await db.orm.public.Attachment.create({
      taskId: hero,
      userId: ids.priya!,
      filename,
      originalName: 'homepage-notes.txt',
      mimeType: 'text/plain',
      size: 72,
    })
    await db.orm.public.Comment.create({
      taskId: hero,
      userId: ids.rahul!,
      body: 'The current headline still describes the product. Can we describe the outcome for a team lead instead?',
    })
  }

  const samples: { actor: string; type: string; message: string; when: string; taskTitle?: string; project?: string }[] = [
    { actor: 'rahul', type: 'task.completed', message: 'completed “Design system tokens”', when: at(-2, 16, 20), taskTitle: 'Design system tokens', project: 'web' },
    { actor: 'priya', type: 'attachment.created', message: 'uploaded a document on “Finalize homepage hero”', when: at(0, 9, 40), taskTitle: 'Finalize homepage hero', project: 'web' },
    { actor: 'amit', type: 'task.started', message: 'started working on “Checkout flow QA”', when: at(0, 10, 5), taskTitle: 'Checkout flow QA', project: 'mobile' },
    { actor: 'rahul', type: 'task.created', message: 'assigned “Fix login crash on Android”', when: at(-1, 9, 15), taskTitle: 'Fix login crash on Android', project: 'mobile' },
    { actor: 'kavya', type: 'task.started', message: 'started working on “Customer interview notes”', when: at(-1, 14, 10), taskTitle: 'Customer interview notes', project: 'success' },
    { actor: 'meera', type: 'comment.created', message: 'commented on “Churn interview synthesis”', when: at(-1, 16, 45), taskTitle: 'Churn interview synthesis', project: 'success' },
  ]
  for (const sample of samples) {
    const task = sample.taskTitle ? await db.orm.public.Task.where({ title: sample.taskTitle }).first() : null
    await logActivity({
      workspaceId: workspace.id,
      actorId: ids[sample.actor]!,
      type: sample.type,
      message: sample.message,
      taskId: task?.id,
      projectId: sample.project ? projects[sample.project] : null,
      createdAt: sample.when,
    })
  }

  await db.orm.public.Notification.create({
    userId: ids.ananya!,
    workspaceId: workspace.id,
    type: 'task.submitted',
    title: 'Task ready for review',
    body: 'Dev Patel submitted “App store screenshots” for review.',
    taskId: (await db.orm.public.Task.where({ title: 'App store screenshots' }).first())?.id || null,
    dedupeKey: 'seed:review:screenshots',
  })
  await db.orm.public.Notification.create({
    userId: ids.ananya!,
    workspaceId: workspace.id,
    type: 'task.assigned',
    title: 'New task assigned',
    body: 'Rahul Mehta assigned “Define the north-star metric” to you.',
    dedupeKey: 'seed:assign:north-star',
  })
  await db.orm.public.Notification.create({
    userId: ids.priya!,
    workspaceId: workspace.id,
    type: 'task.assigned',
    title: 'New task assigned',
    body: 'Rahul Mehta assigned “Accessibility pass” to you.',
    dedupeKey: 'seed:assign:a11y',
    readAt: at(0, 8),
  })

  return { seeded: true }
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isDirect) {
  await seedDatabase({ reset: process.argv.includes('--reset') })
  console.log('Seed complete. Sign in with ananya@northstar.dev / Northstar123!')
  await db.close()
}
