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
}

export type RemoteRoomState = {
  roomId: string
  phase: 'lobby' | 'jobs' | 'battle' | 'result'
  round: number
  players: RemotePlayer[]
}

const getBaseUrl = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function apiRequest<T>(path: string, body?: unknown): Promise<T> {
  const baseUrl = getBaseUrl()
  if (!baseUrl) throw new Error('VITE_API_BASE_URL 尚未設定')
  const response = await fetch(baseUrl + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error || '連線失敗')
  return data as T
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
  leave: (roomId: string, playerId: string) =>
    apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/leave`, { playerId }),
}
