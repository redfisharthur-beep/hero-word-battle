export type RemoteAction = 'upgrade' | 'attack' | 'heal' | 'finish' | 'guard'
export type RemoteBattlePhase = 'action' | 'quiz' | 'resolve'

export type RemotePlayer = {
  id: string
  name: string
  host: boolean
  jobId?: string
  hp: number
  maxHp: number
  atk: number
  def: number
  alive: boolean
  guard: boolean
  action?: RemoteAction
  answered?: boolean
  coefficient?: number
}

export type RemoteQuestion = {
  id: number
  word: string
  choices: string[]
}

export type RemoteRoomState = {
  roomId: string
  phase: 'lobby' | 'jobs' | 'battle' | 'result'
  battlePhase: RemoteBattlePhase
  round: number
  questionIndex: number
  question?: RemoteQuestion
  players: RemotePlayer[]
  log: string[]
}

const getBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export const multiplayerEnabled = () => Boolean(getBaseUrl())

async function apiRequest<T>(path: string, body?: unknown): Promise<T> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) throw new Error('VITE_API_BASE_URL 尚未設定')
  const response = await fetch(baseUrl + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error || `連線失敗 (${response.status})`)
  return data as T
}

const roomPath = (roomId: string, action: string) => `/api/rooms/${encodeURIComponent(roomId)}/${action}`

export const multiplayerApi = {
  health: () => apiRequest<{ ok: boolean; version?: string }>('/api/health'),
  state: (roomId: string) => apiRequest<RemoteRoomState>(roomPath(roomId, 'state')),
  join: (roomId: string, name: string, playerId?: string) =>
    apiRequest<{ playerId: string; state: RemoteRoomState }>(roomPath(roomId, 'join'), { name, playerId }),
  chooseJob: (roomId: string, playerId: string, jobId: string) =>
    apiRequest<RemoteRoomState>(roomPath(roomId, 'choose-job'), { playerId, jobId }),
  start: (roomId: string, playerId: string) =>
    apiRequest<RemoteRoomState>(roomPath(roomId, 'start'), { playerId }),
  chooseAction: (roomId: string, playerId: string, action: RemoteAction) =>
    apiRequest<RemoteRoomState>(roomPath(roomId, 'action'), { playerId, action }),
  forceQuiz: (roomId: string, playerId: string) =>
    apiRequest<RemoteRoomState>(roomPath(roomId, 'force-quiz'), { playerId }),
  answer: (roomId: string, playerId: string, choice: string, coefficient: number) =>
    apiRequest<RemoteRoomState>(roomPath(roomId, 'answer'), { playerId, choice, coefficient }),
  leave: (roomId: string, playerId: string) =>
    apiRequest<RemoteRoomState>(roomPath(roomId, 'leave'), { playerId }),
  reset: (roomId: string, playerId: string) =>
    apiRequest<RemoteRoomState>(roomPath(roomId, 'reset'), { playerId }),
}

export function connectRoom(roomId: string, onState: (state: RemoteRoomState) => void, onError?: (event: Event) => void) {
  const baseUrl = getBaseUrl()
  if (!baseUrl) throw new Error('VITE_API_BASE_URL 尚未設定')
  const wsBase = baseUrl.replace(/^http/, 'ws')
  const socket = new WebSocket(`${wsBase}${roomPath(roomId, 'ws')}`)

  socket.addEventListener('message', (event) => {
    if (event.data === 'pong') return
    try {
      const message = JSON.parse(String(event.data))
      if (message?.type === 'state' && message.state) onState(message.state as RemoteRoomState)
    } catch {
      // Ignore malformed messages and keep the connection alive.
    }
  })
  if (onError) socket.addEventListener('error', onError)

  const heartbeat = window.setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) socket.send('ping')
  }, 25_000)

  return () => {
    window.clearInterval(heartbeat)
    socket.close()
  }
}
