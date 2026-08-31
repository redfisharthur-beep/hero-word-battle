export type RemoteAction = 'upgrade' | 'attack' | 'heal' | 'finish' | 'guard'

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
  battlePhase: 'action' | 'quiz' | 'resolve'
  round: number
  questionIndex: number
  question?: RemoteQuestion
  players: RemotePlayer[]
  log: string[]
}

const getBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const requestUrl = (path: string) => `${getBaseUrl()}${path}`

export const hasMultiplayerApi = () => true

async function apiRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(requestUrl(path), {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error || '連線失敗')
  return data as T
}

export function connectRoom(roomId: string, onState: (state: RemoteRoomState) => void) {
  const baseUrl = getBaseUrl()
  const wsBase = baseUrl
    ? baseUrl.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  let socket: WebSocket | null = new WebSocket(`${wsBase}/api/rooms/${encodeURIComponent(roomId)}/ws`)
  let pingTimer: number | undefined

  socket.onopen = () => {
    pingTimer = window.setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) socket.send('ping')
    }, 20000)
  }

  socket.onmessage = (event) => {
    if (event.data === 'pong') return
    try {
      const payload = JSON.parse(event.data)
      if (payload?.type === 'state' && payload.state) onState(payload.state)
    } catch {
      // Ignore malformed realtime packets.
    }
  }

  return () => {
    if (pingTimer) window.clearInterval(pingTimer)
    socket?.close()
    socket = null
  }
}

export const multiplayerApi = {
  health: () => apiRequest<{ ok: boolean }>('/api/health'),
  state: (roomId: string) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/state`),
  join: (roomId: string, name: string, playerId?: string) =>
    apiRequest<{ playerId: string; state: RemoteRoomState }>(`/api/rooms/${encodeURIComponent(roomId)}/join`, { name, playerId }),
  chooseJob: (roomId: string, playerId: string, jobId: string) =>
    apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/choose-job`, { playerId, jobId }),
  start: (roomId: string, playerId: string) =>
    apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/start`, { playerId }),
  action: (roomId: string, playerId: string, action: RemoteAction) =>
    apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/action`, { playerId, action }),
  forceQuiz: (roomId: string, playerId: string) =>
    apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/force-quiz`, { playerId }),
  answer: (roomId: string, playerId: string, choice: string, coefficient: number) =>
    apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/answer`, { playerId, choice, coefficient }),
  leave: (roomId: string, playerId: string) =>
    apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/leave`, { playerId }),
  reset: (roomId: string, playerId: string) =>
    apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/reset`, { playerId }),
}
