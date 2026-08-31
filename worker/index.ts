export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>
}

type Player = {
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

type RoomState = {
  roomId: string
  phase: 'lobby' | 'jobs' | 'battle' | 'result'
  round: number
  players: Player[]
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
  })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return json({ ok: true })

    const url = new URL(request.url)
    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'hero-word-battle-api' })
    }

    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/)
    if (!match) return json({ error: 'Not found' }, 404)

    const roomId = decodeURIComponent(match[1])
    const subPath = match[2] || '/state'
    const id = env.ROOMS.idFromName(roomId)
    const stub = env.ROOMS.get(id)

    const forwarded = new URL(request.url)
    forwarded.pathname = subPath
    return stub.fetch(new Request(forwarded, request))
  },
}

export class GameRoom extends DurableObject<Env> {
  private stateData: RoomState | null = null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  private async getState(): Promise<RoomState> {
    if (this.stateData) return this.stateData
    const stored = await this.ctx.storage.get<RoomState>('state')
    this.stateData = stored ?? {
      roomId: this.ctx.id.toString(),
      phase: 'lobby',
      round: 0,
      players: [],
    }
    return this.stateData
  }

  private async save(state: RoomState) {
    this.stateData = state
    await this.ctx.storage.put('state', state)
    this.broadcast({ type: 'state', state })
  }

  private broadcast(payload: unknown) {
    const message = JSON.stringify(payload)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message)
      } catch {
        // Ignore disconnected sockets; Cloudflare will clean them up.
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected websocket', { status: 426 })
      }
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)
      const state = await this.getState()
      server.send(JSON.stringify({ type: 'state', state }))
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/state' && request.method === 'GET') {
      return json(await this.getState())
    }

    if (url.pathname === '/join' && request.method === 'POST') {
      const body = (await request.json()) as { playerId?: string; name?: string }
      const playerId = (body.playerId || crypto.randomUUID()).trim()
      const name = (body.name || '').trim().slice(0, 12)
      if (!name) return json({ error: 'Name required' }, 400)

      const state = await this.getState()
      const existing = state.players.find((p) => p.id === playerId)
      if (existing) {
        existing.name = name
        await this.save(state)
        return json({ playerId, state })
      }
      if (state.phase !== 'lobby') return json({ error: 'Game already started' }, 409)
      if (state.players.length >= 4) return json({ error: 'Room full' }, 409)

      state.players.push({
        id: playerId,
        name,
        host: state.players.length === 0,
        hp: 100,
        maxHp: 100,
        atk: 10,
        def: 5,
        alive: true,
      })
      await this.save(state)
      return json({ playerId, state })
    }

    if (url.pathname === '/choose-job' && request.method === 'POST') {
      const body = (await request.json()) as { playerId?: string; jobId?: string }
      const state = await this.getState()
      const player = state.players.find((p) => p.id === body.playerId)
      if (!player) return json({ error: 'Player not found' }, 404)
      if (!body.jobId) return json({ error: 'Job required' }, 400)
      player.jobId = body.jobId
      if (state.phase === 'lobby') state.phase = 'jobs'
      await this.save(state)
      return json(state)
    }

    if (url.pathname === '/start' && request.method === 'POST') {
      const body = (await request.json()) as { playerId?: string }
      const state = await this.getState()
      const player = state.players.find((p) => p.id === body.playerId)
      if (!player?.host) return json({ error: 'Host only' }, 403)
      if (state.players.length < 2) return json({ error: 'Need at least 2 players' }, 409)
      if (state.players.some((p) => !p.jobId)) return json({ error: 'Every player must choose a job' }, 409)
      state.phase = 'battle'
      state.round = 1
      await this.save(state)
      return json(state)
    }

    if (url.pathname === '/leave' && request.method === 'POST') {
      const body = (await request.json()) as { playerId?: string }
      const state = await this.getState()
      const leaving = state.players.find((p) => p.id === body.playerId)
      state.players = state.players.filter((p) => p.id !== body.playerId)
      if (leaving?.host && state.players[0]) state.players[0].host = true
      if (state.players.length === 0) {
        state.phase = 'lobby'
        state.round = 0
      }
      await this.save(state)
      return json(state)
    }

    return json({ error: 'Not found' }, 404)
  }

  webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === 'string' && message === 'ping') {
      _ws.send('pong')
    }
  }
}
