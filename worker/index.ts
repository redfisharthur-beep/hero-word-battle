export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>
}

type Phase = 'lobby' | 'jobs' | 'battle' | 'result'
type BattlePhase = 'action' | 'quiz' | 'resolve'
type ActionName = 'upgrade' | 'attack' | 'heal' | 'finish' | 'guard'

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
  guard: boolean
  action?: ActionName
  answered?: boolean
  coefficient?: number
}

type Question = {
  id: number
  word: string
  answer: string
  choices: string[]
}

type PublicQuestion = Omit<Question, 'answer'>

type RoomState = {
  roomId: string
  phase: Phase
  battlePhase: BattlePhase
  round: number
  questionIndex: number
  question?: PublicQuestion
  players: Player[]
  log: string[]
}

const questions: Question[] = [
  { id: 1, word: 'brave', answer: '勇敢的', choices: ['安靜的', '勇敢的', '飢餓的'] },
  { id: 2, word: 'shield', answer: '盾牌', choices: ['盾牌', '箭矢', '城堡'] },
  { id: 3, word: 'heal', answer: '治療', choices: ['逃跑', '攻擊', '治療'] },
  { id: 4, word: 'victory', answer: '勝利', choices: ['失敗', '勝利', '危險'] },
  { id: 5, word: 'enemy', answer: '敵人', choices: ['敵人', '朋友', '老師'] },
  { id: 6, word: 'protect', answer: '保護', choices: ['保護', '破壞', '尋找'] },
  { id: 7, word: 'strong', answer: '強壯的', choices: ['快速的', '疲累的', '強壯的'] },
  { id: 8, word: 'attack', answer: '攻擊', choices: ['防守', '攻擊', '等待'] },
  { id: 9, word: 'magic', answer: '魔法', choices: ['魔法', '盔甲', '道路'] },
  { id: 10, word: 'survive', answer: '生存', choices: ['投降', '生存', '睡覺'] },
  { id: 11, word: 'sword', answer: '劍', choices: ['弓', '劍', '盾牌'] },
  { id: 12, word: 'danger', answer: '危險', choices: ['安全', '危險', '和平'] },
]

const jobs = new Set(['assassin', 'warrior', 'fighter', 'archer', 'priest'])
const actions = new Set<ActionName>(['upgrade', 'attack', 'heal', 'finish', 'guard'])

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

const publicQuestion = (question: Question): PublicQuestion => ({
  id: question.id,
  word: question.word,
  choices: question.choices,
})

const clampCoefficient = (value: number) => Math.max(0, Math.min(4, Math.floor(value)))

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return json({ ok: true })

    const url = new URL(request.url)
    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'hero-word-battle-api', version: '0.3.0' })
    }

    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/)
    if (!match) return json({ error: 'Not found' }, 404)

    const roomId = decodeURIComponent(match[1]).slice(0, 64)
    const subPath = match[2] || '/state'
    const id = env.ROOMS.idFromName(roomId)
    const stub = env.ROOMS.get(id)
    const forwarded = new URL(request.url)
    forwarded.pathname = subPath
    forwarded.searchParams.set('roomId', roomId)
    return stub.fetch(new Request(forwarded, request))
  },
}

export class GameRoom extends DurableObject<Env> {
  private stateData: RoomState | null = null

  private async getState(roomId?: string): Promise<RoomState> {
    if (this.stateData) return this.stateData
    const stored = await this.ctx.storage.get<RoomState>('state')
    this.stateData = stored ?? {
      roomId: roomId || this.ctx.id.toString(),
      phase: 'lobby',
      battlePhase: 'action',
      round: 0,
      questionIndex: 0,
      players: [],
      log: [],
    }
    return this.stateData
  }

  private async save(state: RoomState) {
    state.log = state.log.slice(-12)
    this.stateData = state
    await this.ctx.storage.put('state', state)
    this.broadcast({ type: 'state', state })
  }

  private broadcast(payload: unknown) {
    const message = JSON.stringify(payload)
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(message) } catch { /* disconnected */ }
    }
  }

  private resetBattle(state: RoomState) {
    state.round = 1
    state.questionIndex = 0
    state.battlePhase = 'action'
    state.question = undefined
    state.log = ['戰鬥開始！']
    for (const player of state.players) {
      player.hp = 100
      player.maxHp = 100
      player.atk = 10
      player.def = 5
      player.alive = true
      player.guard = false
      player.action = undefined
      player.answered = false
      player.coefficient = undefined
    }
  }

  private prepareQuiz(state: RoomState) {
    state.battlePhase = 'quiz'
    const q = questions[state.questionIndex % questions.length]
    state.question = publicQuestion(q)
    for (const player of state.players) {
      player.answered = !player.alive
      player.coefficient = player.alive ? undefined : 0
    }
  }

  private applyAction(actor: Player, state: RoomState) {
    const action = actor.action
    const coefficient = clampCoefficient(actor.coefficient ?? 0)
    if (!action || coefficient <= 0 || !actor.alive) return `${actor.name} 本回合沒有行動。`

    const livingTargets = state.players.filter((p) => p.id !== actor.id && p.alive)
    const jobMultiplier =
      action === 'attack' && actor.jobId === 'archer' ? 1.6 :
      action === 'heal' && actor.jobId === 'priest' ? 1.8 :
      action === 'finish' && actor.jobId === 'assassin' ? 1.35 : 1

    if (action === 'upgrade') {
      const hpBase = actor.jobId === 'warrior' ? 8 : 4
      const atkBase = actor.jobId === 'assassin' ? 3 : 1
      const defBase = actor.jobId === 'fighter' ? 3 : 1
      const hp = Math.round(hpBase * coefficient)
      const atk = Math.round(atkBase * coefficient)
      const def = Math.round(defBase * coefficient)
      actor.maxHp += hp
      actor.hp += hp
      actor.atk += atk
      actor.def += def
      return `${actor.name} 升級：HP +${hp}、ATK +${atk}、DEF +${def}`
    }

    if (action === 'heal') {
      const amount = Math.round((14 + actor.atk * 0.45) * coefficient * jobMultiplier)
      if (actor.hp >= actor.maxHp) {
        const gain = Math.max(1, Math.round(amount * 0.5))
        actor.maxHp += gain
        actor.hp += gain
        return `${actor.name} 滿血治療，生命上限 +${gain}`
      }
      const before = actor.hp
      actor.hp = Math.min(actor.maxHp, actor.hp + amount)
      return `${actor.name} 恢復 ${actor.hp - before} HP`
    }

    if (action === 'guard') {
      actor.guard = true
      return `${actor.name} 進入減傷狀態。`
    }

    if (!livingTargets.length) return `${actor.name} 找不到攻擊目標。`
    const target = [...livingTargets].sort((a, b) => action === 'attack' ? b.hp - a.hp : a.hp - b.hp)[0]
    const actionMultiplier = action === 'finish' ? 1.15 : 1
    const raw = Math.max(1, Math.round(actor.atk * coefficient * actionMultiplier * jobMultiplier - target.def))
    const damage = target.guard ? Math.max(1, Math.round(raw * 0.5)) : raw
    target.guard = false
    target.hp = Math.max(0, target.hp - damage)
    target.alive = target.hp > 0
    return `${actor.name} ${action === 'finish' ? '尾刀' : '攻擊'} ${target.name}，造成 ${damage} 傷害${target.alive ? '' : '（擊倒）'}`
  }

  private resolveRound(state: RoomState) {
    state.battlePhase = 'resolve'
    for (const player of state.players.filter((p) => p.alive)) {
      state.log.push(this.applyAction(player, state))
    }
    state.question = undefined

    const living = state.players.filter((p) => p.alive)
    if (state.round >= 10 || living.length <= 1) {
      state.phase = 'result'
      state.log.push('對戰結束！')
      return
    }

    state.round += 1
    state.questionIndex += 1
    state.battlePhase = 'action'
    for (const player of state.players) {
      player.action = undefined
      player.answered = false
      player.coefficient = undefined
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const state = await this.getState(url.searchParams.get('roomId') || undefined)

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 })
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)
      server.send(JSON.stringify({ type: 'state', state }))
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/state' && request.method === 'GET') return json(state)

    if (url.pathname === '/join' && request.method === 'POST') {
      const body = (await request.json()) as { playerId?: string; name?: string }
      const playerId = (body.playerId || crypto.randomUUID()).trim()
      const name = (body.name || '').trim().slice(0, 12)
      if (!name) return json({ error: 'Name required' }, 400)
      const existing = state.players.find((p) => p.id === playerId)
      if (existing) {
        existing.name = name
        await this.save(state)
        return json({ playerId, state })
      }
      if (state.phase !== 'lobby') return json({ error: 'Game already started' }, 409)
      if (state.players.length >= 4) return json({ error: 'Room full' }, 409)
      state.players.push({ id: playerId, name, host: state.players.length === 0, hp: 100, maxHp: 100, atk: 10, def: 5, alive: true, guard: false })
      await this.save(state)
      return json({ playerId, state })
    }

    if (url.pathname === '/choose-job' && request.method === 'POST') {
      const body = (await request.json()) as { playerId?: string; jobId?: string }
      const player = state.players.find((p) => p.id === body.playerId)
      if (!player) return json({ error: 'Player not found' }, 404)
      if (!body.jobId || !jobs.has(body.jobId)) return json({ error: 'Invalid job' }, 400)
      player.jobId = body.jobId
      if (state.phase === 'lobby') state.phase = 'jobs'
      await this.save(state)
      return json(state)
    }

    if (url.pathname === '/start' && request.method === 'POST') {
      const body = (await request.json()) as { playerId?: string }
      const player = state.players.find((p) => p.id === body.playerId)
      if (!player?.host) return json({ error: 'Host only' }, 403)
      if (state.players.length < 2) return json({ error: 'Need at least 2 players' }, 409)
      if (state.players.some((p) => !p.jobId)) return json({ error: 'Every player must choose a job' }, 409)
      state.phase = 'battle'
      this.resetBattle(state)
      await this.save(state)
      return json(state)
    }

    if (url.pathname === '/action' && request.method === 'POST') {
      if (state.phase !== 'battle' || state.battlePhase !== 'action') return json({ error: 'Not accepting actions' }, 409)
      const body = (await request.json()) as { playerId?: string; action?: ActionName }
      const player = state.players.find((p) => p.id === body.playerId)
      if (!player?.alive) return json({ error: 'Player not available' }, 404)
      if (!body.action || !actions.has(body.action)) return json({ error: 'Invalid action' }, 400)
      player.action = body.action
      if (state.players.filter((p) => p.alive).every((p) => p.action)) this.prepareQuiz(state)
      await this.save(state)
      return json(state)
    }

    if (url.pathname === '/force-quiz' && request.method === 'POST') {
      if (state.phase !== 'battle' || state.battlePhase !== 'action') return json({ error: 'Wrong phase' }, 409)
      const body = (await request.json()) as { playerId?: string }
      const player = state.players.find((p) => p.id === body.playerId)
      if (!player) return json({ error: 'Player not found' }, 404)
      if (!player.action) player.action = 'upgrade'
      if (state.players.filter((p) => p.alive).every((p) => p.action)) this.prepareQuiz(state)
      await this.save(state)
      return json(state)
    }

    if (url.pathname === '/answer' && request.method === 'POST') {
      if (state.phase !== 'battle' || state.battlePhase !== 'quiz') return json({ error: 'Not accepting answers' }, 409)
      const body = (await request.json()) as { playerId?: string; choice?: string; coefficient?: number }
      const player = state.players.find((p) => p.id === body.playerId)
      if (!player?.alive) return json({ error: 'Player not available' }, 404)
      if (player.answered) return json({ error: 'Already answered' }, 409)
      const question = questions[state.questionIndex % questions.length]
      player.answered = true
      player.coefficient = body.choice === question.answer ? clampCoefficient(Number(body.coefficient || 0)) : 0
      if (state.players.filter((p) => p.alive).every((p) => p.answered)) this.resolveRound(state)
      await this.save(state)
      return json(state)
    }

    if (url.pathname === '/leave' && request.method === 'POST') {
      const body = (await request.json()) as { playerId?: string }
      const leaving = state.players.find((p) => p.id === body.playerId)
      state.players = state.players.filter((p) => p.id !== body.playerId)
      if (leaving?.host && state.players[0]) state.players[0].host = true
      if (state.players.length === 0) {
        state.phase = 'lobby'
        state.battlePhase = 'action'
        state.round = 0
        state.question = undefined
        state.log = []
      } else if (state.phase === 'battle' && state.players.filter((p) => p.alive).length <= 1) {
        state.phase = 'result'
      }
      await this.save(state)
      return json(state)
    }

    if (url.pathname === '/reset' && request.method === 'POST') {
      const body = (await request.json()) as { playerId?: string }
      const player = state.players.find((p) => p.id === body.playerId)
      if (!player?.host) return json({ error: 'Host only' }, 403)
      state.phase = 'jobs'
      state.round = 0
      state.battlePhase = 'action'
      state.question = undefined
      state.log = []
      for (const p of state.players) {
        p.hp = 100; p.maxHp = 100; p.atk = 10; p.def = 5; p.alive = true; p.guard = false
        p.action = undefined; p.answered = false; p.coefficient = undefined
      }
      await this.save(state)
      return json(state)
    }

    return json({ error: 'Not found' }, 404)
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === 'string' && message === 'ping') ws.send('pong')
  }
}
