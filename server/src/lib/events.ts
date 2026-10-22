type Emit = (room: string, event: string, payload: unknown) => void

let emit: Emit = () => {}

export function setEmitter(fn: Emit) {
  emit = fn
}

export function emitUser(userId: string, event: string, payload: unknown) {
  emit(`user:${userId}`, event, payload)
}

export function emitWorkspace(workspaceId: string, event: string, payload: unknown) {
  emit(`workspace:${workspaceId}`, event, payload)
}
