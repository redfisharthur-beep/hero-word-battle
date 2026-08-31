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

export type RemoteQuestion = { id: number; word: string; choices: string[] }

export type RemoteRoomState = {
  roomId: string
  phase: 'lobby' | 'jobs' | 'battle' | 'result'
  battlePhase: 'action' | 'quiz' | 'resolve'
  round: number
  questionIndex: number
  question?: RemoteQuestion
  jobsEndsAt?: number
  actionEndsAt?: number
  quizEndsAt?: number
  players: RemotePlayer[]
  log: string[]
}

const configuredBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const getBaseUrl = () => {
  const configured = configuredBaseUrl()
  if (configured) return configured
  if (typeof window === 'undefined') return ''
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return ''
  return window.location.origin
}

export const hasMultiplayerApi = () => Boolean(getBaseUrl())

async function apiRequest<T>(path: string, body?: unknown): Promise<T> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) throw new Error('多人伺服器尚未設定')
  const response = await fetch(baseUrl + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error || '連線失敗')
  return data as T
}

function sendLeaveBeacon(roomId: string, playerId: string) {
  const baseUrl = getBaseUrl()
  if (!baseUrl || !roomId || !playerId) return false
  const body = new Blob([JSON.stringify({ playerId })], { type: 'application/json' })
  return navigator.sendBeacon(`${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/leave`, body)
}

export function connectRoom(roomId: string, onState: (state: RemoteRoomState) => void, onConnection?: (connected: boolean) => void) {
  const baseUrl = getBaseUrl()
  if (!baseUrl) return () => undefined
  const wsBase = baseUrl.replace(/^http/, 'ws')
  let stopped = false
  let socket: WebSocket | null = null
  let pingTimer: number | undefined
  let reconnectTimer: number | undefined
  let exitSent = false

  const leaveBecauseHidden = () => {
    if (exitSent) return
    const playerId = localStorage.getItem('hero-player-id') || ''
    if (!playerId) return
    exitSent = true
    stopped = true
    sendLeaveBeacon(roomId, playerId)
    localStorage.removeItem('hero-room-id')
    localStorage.removeItem('hero-player-id')
    socket?.close()
  }

  const onVisibilityChange = () => {
    if (document.visibilityState !== 'hidden') return
    leaveBecauseHidden()
    window.location.replace('/')
  }
  const onPageHide = () => leaveBecauseHidden()

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)

  const connect = () => {
    if (stopped) return
    socket = new WebSocket(`${wsBase}/api/rooms/${encodeURIComponent(roomId)}/ws`)
    socket.onopen = () => {
      onConnection?.(true)
      pingTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send('ping')
      }, 20000)
    }
    socket.onmessage = (event) => {
      if (event.data === 'pong') return
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type === 'state' && payload.state) onState(payload.state)
      } catch { /* ignore malformed packets */ }
    }
    socket.onclose = () => {
      onConnection?.(false)
      if (pingTimer) window.clearInterval(pingTimer)
      if (!stopped) reconnectTimer = window.setTimeout(connect, 1200)
    }
    socket.onerror = () => socket?.close()
  }

  connect()
  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
    if (pingTimer) window.clearInterval(pingTimer)
    if (reconnectTimer) window.clearTimeout(reconnectTimer)
    socket?.close()
    socket = null
  }
}

export const multiplayerApi = {
  health: () => apiRequest<{ ok: boolean }>('/api/health'),
  state: (roomId: string) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/state`),
  join: (roomId: string, name: string, playerId?: string) => apiRequest<{ playerId: string; state: RemoteRoomState }>(`/api/rooms/${encodeURIComponent(roomId)}/join`, { name, playerId }),
  beginJobs: (roomId: string, playerId: string) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/begin-jobs`, { playerId }),
  chooseJob: (roomId: string, playerId: string, jobId: string) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/choose-job`, { playerId, jobId }),
  start: (roomId: string, playerId: string) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/start`, { playerId }),
  action: (roomId: string, playerId: string, action: RemoteAction) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/action`, { playerId, action }),
  answer: (roomId: string, playerId: string, choice: string, coefficient: number) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/answer`, { playerId, choice, coefficient }),
  tick: (roomId: string) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/tick`, {}),
  leave: (roomId: string, playerId: string) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/leave`, { playerId }),
  leaveBeacon: sendLeaveBeacon,
  reset: (roomId: string, playerId: string) => apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/reset`, { playerId }),
}
