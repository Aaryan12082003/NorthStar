import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createApp } from './app.ts'
import { getAuthByToken } from './lib/auth.ts'
import { setEmitter } from './lib/events.ts'
import { startScheduler } from './jobs/scheduler.ts'
import { seedDatabase } from './seed.ts'

const port = Number(process.env.PORT || 4732)
const app = createApp()
const server = createServer(app)
const io = new Server(server, { cors: { origin: true, credentials: true } })

setEmitter((room, event, payload) => {
  io.to(room).emit(event, payload)
})

io.use(async (socket, next) => {
  try {
    const header = socket.request.headers.cookie
    const token = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith('ns_session='))?.slice('ns_session='.length)
    const auth = await getAuthByToken(token ? decodeURIComponent(token) : null)
    if (!auth) {
      next(new Error('unauthorized'))
      return
    }
    socket.data.auth = auth
    next()
  } catch (error) {
    next(error instanceof Error ? error : new Error('unauthorized'))
  }
})

io.on('connection', (socket) => {
  const auth = socket.data.auth as { user: { id: string }; workspaceId: string }
  socket.join(`user:${auth.user.id}`)
  socket.join(`workspace:${auth.workspaceId}`)
})

await seedDatabase()
await startScheduler()

server.listen(port, '0.0.0.0', () => {
  console.log(`Northstar API listening on http://127.0.0.1:${port}`)
})
