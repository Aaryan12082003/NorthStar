import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { runDeadlineReminders, runRecurringTasks } from '../lib/domain.ts'

async function scan() {
  await runDeadlineReminders()
  await runRecurringTasks()
}

export async function startScheduler() {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  try {
    const connection = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: true })
    await connection.connect()
    await connection.ping()
    const queue = new Queue('northstar-reminders', { connection })
    await queue.upsertJobScheduler('deadline-scan', { every: 60_000 }, { name: 'scan', data: {} })
    const worker = new Worker('northstar-reminders', async () => scan(), { connection })
    worker.on('failed', (_job, error) => {
      console.error('Reminder job failed', error)
    })
    await scan()
    return { mode: 'bullmq' as const, worker, queue }
  } catch (error) {
    console.error('Redis is unavailable. Deadline reminders will run in-process.', error)
    const timer = setInterval(() => {
      scan().catch((scanError) => console.error('Reminder scan failed', scanError))
    }, 60_000)
    timer.unref?.()
    await scan()
    return { mode: 'interval' as const, timer }
  }
}
