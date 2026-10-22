import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { runDeadlineReminders, runRecurringTasks } from '../lib/domain.ts'
import { db } from '../prisma/db.ts'
import { seedDatabase } from '../seed.ts'

const app = createApp()
const server = createServer(app)

async function login(email: string) {
  const agent = request.agent(server)
  const response = await agent.post('/api/auth/login').send({ email, password: 'Northstar123!' })
  assert.equal(response.status, 200, JSON.stringify(response.body))
  return agent
}

describe('Northstar API', { concurrency: 1 }, () => {
  before(async () => {
    await seedDatabase({ reset: true })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await db.close()
  })

  it('rejects an unknown password', async () => {
    const response = await request(server).post('/api/auth/login').send({ email: 'ananya@northstar.dev', password: 'nope' })
    assert.equal(response.status, 401)
  })

  it('returns the signed-in admin and dashboard', async () => {
    const agent = await login('ananya@northstar.dev')
    const me = await agent.get('/api/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.body.user.role, 'ADMIN')
    assert.equal(me.body.workspace.name, 'Northstar')

    const dashboard = await agent.get('/api/dashboard')
    assert.equal(dashboard.status, 200)
    assert.equal(typeof dashboard.body.stats.total.value, 'number')
    assert.ok(dashboard.body.stats.total.value > 0)
    assert.equal(dashboard.body.byStatus.length, 5)
    assert.ok(dashboard.body.upcoming.length > 0)
    assert.ok(dashboard.body.activity.some((item: { message: string }) => item.message.includes('completed')))
  })

  it('keeps employees inside their own tasks and blocks project creation', async () => {
    const admin = await login('ananya@northstar.dev')
    const projects = await admin.get('/api/projects')
    const projectId = projects.body[0].id
    const created = await admin.post('/api/tasks').send({
      title: 'Private manager task',
      description: 'Only Amit should see this.',
      projectId,
      assigneeIds: [(await admin.get('/api/members')).body.find((member: { email: string }) => member.email === 'amit@northstar.dev').id],
      priority: 'HIGH',
      deadline: new Date(Date.now() + 86_400_000).toISOString(),
      estimatedHours: 2,
      tags: ['Engineering'],
      subtasks: [{ title: 'Reproduce the failure' }],
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.assignees.length, 1)

    const priya = await login('priya@northstar.dev')
    const hidden = await priya.get(`/api/tasks/${created.body.id}`)
    assert.equal(hidden.status, 404)
    const priyaMe = await priya.get('/api/auth/me')
    const blocked = await priya.post('/api/projects').send({
      name: 'Side project',
      ownerId: priyaMe.body.user.id,
      memberIds: [],
    })
    assert.equal(blocked.status, 403)

    const amit = await login('amit@northstar.dev')
    const visible = await amit.get(`/api/tasks/${created.body.id}`)
    assert.equal(visible.status, 200)
    const commented = await amit.post(`/api/tasks/${created.body.id}/comments`).send({ body: 'I can reproduce this on the Pixel.' })
    assert.equal(commented.status, 201)
    assert.ok(commented.body.comments.some((comment: { body: string }) => comment.body.includes('Pixel')))
    const submitted = await amit.post(`/api/tasks/${created.body.id}/transition`).send({ status: 'IN_PROGRESS' })
    assert.equal(submitted.status, 200)
    const review = await amit.post(`/api/tasks/${created.body.id}/transition`).send({ status: 'IN_REVIEW' })
    assert.equal(review.status, 200)

    const manager = await login('rahul@northstar.dev')
    const approved = await manager.post(`/api/tasks/${created.body.id}/review`).send({ action: 'approve', note: 'Looks good.' })
    assert.equal(approved.status, 200)
    assert.equal(approved.body.status, 'COMPLETED')

    const notes = await amit.get('/api/notifications')
    assert.equal(notes.status, 200)
    assert.ok(notes.body.items.some((item: { type: string }) => item.type === 'task.approved'))
    await admin.delete(`/api/tasks/${created.body.id}`)
  })

  it('does not send the same deadline reminder twice', async () => {
    await runDeadlineReminders()
    const ananya = await db.orm.public.User.where({ email: 'ananya@northstar.dev' }).first()
    const first = await db.orm.public.Notification.where({ userId: ananya!.id }).all()
    await runDeadlineReminders()
    const second = await db.orm.public.Notification.where({ userId: ananya!.id }).all()
    assert.equal(first.length, second.length)
    assert.ok(second.some((row) => row.type.startsWith('task.due') || row.type === 'task.overdue' || row.type === 'task.submitted'))
  })

  it('creates the next occurrence of a recurring task once', async () => {
    const before = await db.orm.public.Task.where((row) => row.title.eq('Weekly planning notes')).all()
    await runRecurringTasks()
    await runRecurringTasks()
    const after = await db.orm.public.Task.where((row) => row.title.eq('Weekly planning notes')).all()
    assert.equal(after.length, before.length + 1)
  })

  it('exports a csv report and filters tasks', async () => {
    const agent = await login('ananya@northstar.dev')
    const tasks = await agent.get('/api/tasks').query({ priority: 'URGENT', pageSize: 20 })
    assert.equal(tasks.status, 200)
    assert.ok(tasks.body.items.every((task: { priority: string }) => task.priority === 'URGENT'))
    const csv = await agent.get('/api/reports/export').query({ format: 'csv' })
    assert.equal(csv.status, 200)
    assert.match(csv.text, /Employee,Completed/)
    const xlsx = await agent.get('/api/reports/export').query({ format: 'xlsx' })
    assert.equal(xlsx.status, 200)
    assert.match(String(xlsx.headers['content-type']), /spreadsheetml/)
  })

  it('logs out', async () => {
    const agent = await login('ananya@northstar.dev')
    const response = await agent.post('/api/auth/logout')
    assert.equal(response.status, 200)
    const me = await agent.get('/api/auth/me')
    assert.equal(me.status, 401)
  })
})
