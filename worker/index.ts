import { DurableObject } from 'cloudflare:workers'
import { getVocabularyQuestion, vocabularyCounts, type WordPoolSize } from './vocab.generated'

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>
  ASSETS: Fetcher
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
  answeredAt?: number
  answerCorrect?: boolean
  lastSeen?: number
}

type Question = { id: number; word: string; answer: string; choices: string[] }
type PublicQuestion = Omit<Question, 'answer'>
type StatChange = {
  playerId: string
  name: string
  hp?: number
  maxHp?: number
  atk?: number
  def?: number
  guard?: 'on' | 'off'
  ko?: boolean
}
type ActionResult = {
  id: string
  playerId: string
  playerName: string
  action?: ActionName
  coefficient: number
  correct: boolean
  text: string
  changes: StatChange[]
}
type Snapshot = Map<string, { hp: number; maxHp: number; atk: number; def: number; guard: boolean; alive: boolean }>

type RoomState = {
  roomId: string
  phase: Phase
  battlePhase: BattlePhase
  round: number
  questionIndex: number
  question?: PublicQuestion
  wordPoolSize: WordPoolSize
  jobsEndsAt?: number
  actionEndsAt?: number
  quizEndsAt?: number
  resolveEndsAt?: number
  resolveQueue?: string[]
  resolveIndex?: number
  currentResult?: ActionResult
  players: Player[]
  log: string[]
}

const ACTION_MS = 5000
const QUIZ_MS = 8000
const JOBS_MS = 30000
const RESOLVE_STEP_MS = 1900
const PRESENCE_MS = 45000
const SWEEP_MS = 15000
const wordPoolSizes = new Set<WordPoolSize>([300, 1200, 6000])
const jobIds = ['assassin', 'warrior', 'fighter', 'archer', 'priest', 'mage']
const jobs = new Set(jobIds)
const actionIds: ActionName[] = ['upgrade', 'attack', 'heal', 'finish', 'guard']
const actions = new Set<ActionName>(actionIds)

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

const publicQuestion = (q: Question): PublicQuestion => ({ id: q.id, word: q.word, choices: q.choices })
const clampCoefficient = (v: number) => Math.max(0, Math.min(4, Math.floor(v)))

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return json({ ok: true })
    const url = new URL(request.url)
    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'hero-word-battle-api', version: '0.9.2', vocabularyCounts })
    }
    const m = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/)
    if (m) {
      const roomId = decodeURIComponent(m[1]).slice(0, 64)
      const sub = m[2] || '/state'
      const id = env.ROOMS.idFromName(roomId)
      const stub = env.ROOMS.get(id)
      const forwarded = new URL(request.url)
      forwarded.pathname = sub
      forwarded.searchParams.set('roomId', roomId)
      return stub.fetch(new Request(forwarded, request))
    }
    return env.ASSETS.fetch(request)
  },
}

export class GameRoom extends DurableObject<Env> {
  private stateData: RoomState | null = null

  private async getState(roomId?: string) {
    if (this.stateData) return this.stateData
    const stored = await this.ctx.storage.get<RoomState>('state')
    this.stateData = stored ?? {
      roomId: roomId || this.ctx.id.toString(),
      phase: 'lobby',
      battlePhase: 'action',
      round: 0,
      questionIndex: 0,
      wordPoolSize: 300,
      players: [],
      log: [],
    }
    if (!wordPoolSizes.has(this.stateData.wordPoolSize)) this.stateData.wordPoolSize = 300
    return this.stateData
  }

  private clearBattleFlow(s: RoomState) {
    s.question = undefined
    s.jobsEndsAt = undefined
    s.actionEndsAt = undefined
    s.quizEndsAt = undefined
    s.resolveEndsAt = undefined
    s.resolveQueue = undefined
    s.resolveIndex = undefined
    s.currentResult = undefined
  }

  private normalizeAfterLeave(s: RoomState) {
    if (s.players.length && !s.players.some((p) => p.host)) s.players[0].host = true
    if (!s.players.length) {
      s.phase = 'lobby'
      s.battlePhase = 'action'
      s.round = 0
      s.log = []
      this.clearBattleFlow(s)
    } else if (s.phase === 'jobs' && s.players.length < 2) {
      s.phase = 'lobby'
      s.jobsEndsAt = undefined
      for (const p of s.players) p.jobId = undefined
    } else if (s.phase === 'battle' && s.players.filter((p) => p.alive).length <= 1) {
      s.phase = 'result'
      this.clearBattleFlow(s)
    }
  }

  private activeSocketIds() {
    const ids = new Set<string>()
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as { playerId?: string } | null
      if (a?.playerId) ids.add(a.playerId)
    }
    return ids
  }

  private pruneStale(s: RoomState) {
    const cutoff = Date.now() - PRESENCE_MS
    const active = this.activeSocketIds()
    const before = s.players.length
    s.players = s.players.filter(
      (p) => active.has(p.id) || (typeof p.lastSeen === 'number' && p.lastSeen >= cutoff),
    )
    if (s.players.length !== before) {
      this.normalizeAfterLeave(s)
      return true
    }
    return false
  }

  private async save(s: RoomState) {
    s.log = s.log.slice(-16)
    this.stateData = s
    await this.ctx.storage.put('state', s)
    const deadline =
      s.phase === 'jobs'
        ? s.jobsEndsAt
        : s.phase === 'battle'
          ? s.battlePhase === 'action'
            ? s.actionEndsAt
            : s.battlePhase === 'quiz'
              ? s.quizEndsAt
              : s.resolveEndsAt
          : undefined
    const presence = s.players.length ? Date.now() + SWEEP_MS : undefined
    const alarm = deadline && presence ? Math.min(deadline, presence) : deadline ?? presence
    if (alarm) await this.ctx.storage.setAlarm(alarm)
    else await this.ctx.storage.deleteAlarm()
    const payload = JSON.stringify({ type: 'state', state: s })
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload)
      } catch {}
    }
  }

  private beginAction(s: RoomState) {
    s.battlePhase = 'action'
    s.question = undefined
    s.quizEndsAt = undefined
    s.resolveEndsAt = undefined
    s.resolveQueue = undefined
    s.resolveIndex = undefined
    s.currentResult = undefined
    s.actionEndsAt = Date.now() + ACTION_MS
    for (const p of s.players) {
      p.action = undefined
      p.answered = false
      p.coefficient = undefined
      p.answeredAt = undefined
      p.answerCorrect = undefined
    }
  }

  private startBattle(s: RoomState) {
    s.phase = 'battle'
    s.jobsEndsAt = undefined
    s.round = 1
    s.questionIndex = Math.floor(Math.random() * s.wordPoolSize)
    s.log = [`戰鬥開始！題庫：${s.wordPoolSize} 字`]
    for (const p of s.players) {
      p.hp = 100
      p.maxHp = 100
      p.atk = 10
      p.def = 5
      p.alive = true
      p.guard = false
    }
    this.beginAction(s)
  }

  private fillRandomJobs(s: RoomState) {
    const used = new Set(s.players.map((p) => p.jobId).filter(Boolean) as string[])
    for (const p of s.players.filter((p) => !p.jobId)) {
      const available = jobIds.filter((j) => !used.has(j))
      const pick = available[Math.floor(Math.random() * available.length)]
      p.jobId = pick
      used.add(pick)
    }
  }

  private currentQuestion(s: RoomState): Question {
    return getVocabularyQuestion(s.wordPoolSize, s.questionIndex)
  }

  private prepareQuiz(s: RoomState) {
    s.battlePhase = 'quiz'
    s.actionEndsAt = undefined
    s.resolveEndsAt = undefined
    s.currentResult = undefined
    s.quizEndsAt = Date.now() + QUIZ_MS
    s.question = publicQuestion(this.currentQuestion(s))
    for (const p of s.players) {
      p.answered = !p.alive
      p.coefficient = p.alive ? undefined : 0
      p.answeredAt = undefined
      p.answerCorrect = p.alive ? undefined : false
    }
  }

  private coefficientFromDeadline(s: RoomState) {
    if (!s.quizEndsAt) return 0
    const n = Math.max(0, Math.ceil((s.quizEndsAt - Date.now()) / 1000))
    return n >= 7 ? 4 : n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0
  }

  private snapshot(s: RoomState): Snapshot {
    return new Map(
      s.players.map((p) => [
        p.id,
        { hp: p.hp, maxHp: p.maxHp, atk: p.atk, def: p.def, guard: p.guard, alive: p.alive },
      ]),
    )
  }

  private changesFrom(before: Snapshot, s: RoomState): StatChange[] {
    const changes: StatChange[] = []
    for (const p of s.players) {
      const old = before.get(p.id)
      if (!old) continue
      const change: StatChange = { playerId: p.id, name: p.name }
      if (p.hp !== old.hp) change.hp = p.hp - old.hp
      if (p.maxHp !== old.maxHp) change.maxHp = p.maxHp - old.maxHp
      if (p.atk !== old.atk) change.atk = p.atk - old.atk
      if (p.def !== old.def) change.def = p.def - old.def
      if (p.guard !== old.guard) change.guard = p.guard ? 'on' : 'off'
      if (old.alive && !p.alive) change.ko = true
      if (
        change.hp !== undefined ||
        change.maxHp !== undefined ||
        change.atk !== undefined ||
        change.def !== undefined ||
        change.guard !== undefined ||
        change.ko
      ) {
        changes.push(change)
      }
    }
    return changes
  }

  private applyAction(a: Player, s: RoomState) {
    const action = a.action
    const c = clampCoefficient(a.coefficient ?? 0)
    if (!action || c <= 0 || !a.alive) {
      if (!a.alive) return `${a.name} 已被擊倒，無法行動。`
      if (!a.answerCorrect) return `${a.name} 答題未成功，技能係數 ×0。`
      return `${a.name} 本回合沒有行動。`
    }
    const targets = s.players.filter((p) => p.id !== a.id && p.alive)
    const mul =
      action === 'attack' && a.jobId === 'archer'
        ? 1.5
        : action === 'heal' && a.jobId === 'priest'
          ? 1.08
          : action === 'finish' && a.jobId === 'assassin'
            ? 1.12
            : 1

    if (action === 'upgrade') {
      const hp = Math.round((a.jobId === 'warrior' ? 5.8 : 4) * c)
      const atk = Math.round((a.jobId === 'assassin' ? 2.2 : 1) * c)
      const def = Math.round((a.jobId === 'fighter' ? 2.7 : 1) * c)
      a.maxHp += hp
      a.hp += hp
      a.atk += atk
      a.def += def
      return `${a.name} 升級成功：HP +${hp}、ATK +${atk}、DEF +${def}`
    }

    if (action === 'heal') {
      const amount = Math.round((14 + a.atk * 0.45) * c * mul)
      if (a.hp >= a.maxHp) {
        const gain = Math.max(1, Math.round(amount * 0.15))
        a.maxHp += gain
        a.hp += gain
        return `${a.name} 滿血治療，生命上限 +${gain}`
      }
      const before = a.hp
      a.hp = Math.min(a.maxHp, a.hp + amount)
      return `${a.name} 治療自己，HP +${a.hp - before}`
    }

    if (action === 'guard') {
      a.guard = true
      return `${a.name} 展開減傷，抵擋下一次攻擊。`
    }

    if (!targets.length) return `${a.name} 找不到可攻擊的目標。`

    if (action === 'attack' && a.jobId === 'mage') {
      let total = 0
      let ko = 0
      const mageMul = targets.length === 1 ? 1.2 : targets.length === 2 ? 1.05 : 0.9
      for (const t of targets) {
        const raw = Math.max(1, Math.round(a.atk * c * mageMul - t.def * 0.5))
        const damage = t.guard ? Math.max(1, Math.round(raw * 0.5)) : raw
        t.guard = false
        t.hp = Math.max(0, t.hp - damage)
        t.alive = t.hp > 0
        total += damage
        if (!t.alive) ko++
      }
      return `${a.name} 施放範圍魔法，攻擊 ${targets.length} 人，共造成 ${total} 傷害${ko ? `，擊倒 ${ko} 人` : ''}。`
    }

    const t = [...targets].sort((x, y) => (action === 'attack' ? y.hp - x.hp : x.hp - y.hp))[0]
    const raw = Math.max(
      1,
      Math.round(a.atk * c * (action === 'finish' ? 1.1 : 1) * mul - t.def),
    )
    const damage = t.guard ? Math.max(1, Math.round(raw * 0.5)) : raw
    t.guard = false
    t.hp = Math.max(0, t.hp - damage)
    t.alive = t.hp > 0
    return `${a.name} ${action === 'finish' ? '尾刀' : '攻擊'} ${t.name}，造成 ${damage} 傷害${t.alive ? '。' : '，擊倒！'}`
  }

  private makeResult(player: Player, s: RoomState): ActionResult {
    const before = this.snapshot(s)
    const text = this.applyAction(player, s)
    return {
      id: `${s.round}-${player.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      playerId: player.id,
      playerName: player.name,
      action: player.action,
      coefficient: clampCoefficient(player.coefficient ?? 0),
      correct: Boolean(player.answerCorrect),
      text,
      changes: this.changesFrom(before, s),
    }
  }

  private startResolve(s: RoomState) {
    s.battlePhase = 'resolve'
    s.quizEndsAt = undefined
    s.question = undefined
    const aliveThisTurn = s.players.filter((p) => p.alive && p.answeredAt !== undefined)
    aliveThisTurn.sort((a, b) => (a.answeredAt ?? Number.MAX_SAFE_INTEGER) - (b.answeredAt ?? Number.MAX_SAFE_INTEGER))
    s.resolveQueue = aliveThisTurn.map((p) => p.id)
    s.resolveIndex = 0
    this.showResolveStep(s)
  }

  private showResolveStep(s: RoomState) {
    const queue = s.resolveQueue ?? []
    const index = s.resolveIndex ?? 0
    const playerId = queue[index]
    if (!playerId) {
      this.finishRound(s)
      return
    }
    const player = s.players.find((p) => p.id === playerId)
    if (!player) {
      s.resolveIndex = index + 1
      this.showResolveStep(s)
      return
    }
    const result = this.makeResult(player, s)
    s.currentResult = result
    s.log.push(result.text)
    s.resolveEndsAt = Date.now() + RESOLVE_STEP_MS
  }

  private nextResolveStep(s: RoomState) {
    s.resolveIndex = (s.resolveIndex ?? 0) + 1
    if ((s.resolveIndex ?? 0) >= (s.resolveQueue?.length ?? 0)) {
      this.finishRound(s)
      return
    }
    this.showResolveStep(s)
  }

  private finishRound(s: RoomState) {
    s.resolveEndsAt = undefined
    s.resolveQueue = undefined
    s.resolveIndex = undefined
    s.currentResult = undefined
    const living = s.players.filter((p) => p.alive)
    if (s.round >= 10 || living.length <= 1) {
      s.phase = 'result'
      s.log.push('對戰結束！')
      return
    }
    s.round++
    s.questionIndex = (s.questionIndex + 1) % s.wordPoolSize
    this.beginAction(s)
  }

  private advanceTimeouts(s: RoomState) {
    const now = Date.now()
    if (s.phase === 'jobs' && s.jobsEndsAt && now >= s.jobsEndsAt) {
      this.fillRandomJobs(s)
      this.startBattle(s)
      return true
    }
    if (s.phase !== 'battle') return false

    if (s.battlePhase === 'action' && s.actionEndsAt && now >= s.actionEndsAt) {
      for (const p of s.players.filter((p) => p.alive)) {
        if (!p.action) p.action = actionIds[Math.floor(Math.random() * actionIds.length)]
      }
      this.prepareQuiz(s)
      s.log.push('動作時間到，未選擇者已隨機決定技能。')
      return true
    }

    if (s.battlePhase === 'quiz' && s.quizEndsAt && now >= s.quizEndsAt) {
      const endTime = s.quizEndsAt
      for (const p of s.players.filter((p) => p.alive)) {
        if (!p.answered) {
          p.answered = true
          p.coefficient = 0
          p.answerCorrect = false
          p.answeredAt = endTime + 1
        }
      }
      s.log.push('8 秒答題結束，依作答完成順序開始行動。')
      this.startResolve(s)
      return true
    }

    if (s.battlePhase === 'resolve' && s.resolveEndsAt && now >= s.resolveEndsAt) {
      this.nextResolveStep(s)
      return true
    }

    return false
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const s = await this.getState(url.searchParams.get('roomId') || undefined)

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 })
      const playerId = url.searchParams.get('playerId') || ''
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)
      server.serializeAttachment({ playerId })
      const p = s.players.find((x) => x.id === playerId)
      if (p) {
        p.lastSeen = Date.now()
        await this.save(s)
      }
      server.send(JSON.stringify({ type: 'state', state: s }))
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/state' && request.method === 'GET') {
      const staleChanged = this.pruneStale(s)
      const timeoutChanged = this.advanceTimeouts(s)
      if (staleChanged || timeoutChanged) await this.save(s)
      return json(s)
    }

    if (url.pathname === '/tick' && request.method === 'POST') {
      const staleChanged = this.pruneStale(s)
      const timeoutChanged = this.advanceTimeouts(s)
      if (staleChanged || timeoutChanged) await this.save(s)
      return json(s)
    }

    if (url.pathname === '/join' && request.method === 'POST') {
      const b = (await request.json()) as { playerId?: string; name?: string }
      const playerId = (b.playerId || crypto.randomUUID()).trim()
      const name = (b.name || '').trim().slice(0, 12)
      if (!name) return json({ error: 'Name required' }, 400)
      this.pruneStale(s)
      const existing = s.players.find((p) => p.id === playerId)
      if (existing) {
        existing.name = name
        existing.lastSeen = Date.now()
        await this.save(s)
        return json({ playerId, state: s })
      }
      if (s.phase !== 'lobby') return json({ error: 'Game already started' }, 409)
      if (s.players.length >= 4) return json({ error: 'Room full' }, 409)
      s.players.push({
        id: playerId,
        name,
        host: s.players.length === 0,
        hp: 100,
        maxHp: 100,
        atk: 10,
        def: 5,
        alive: true,
        guard: false,
        lastSeen: Date.now(),
      })
      await this.save(s)
      return json({ playerId, state: s })
    }

    if (url.pathname === '/word-pool' && request.method === 'POST') {
      const b = (await request.json()) as { playerId?: string; wordPoolSize?: number }
      const p = s.players.find((x) => x.id === b.playerId)
      if (!p?.host) return json({ error: 'Host only' }, 403)
      if (s.phase !== 'lobby') return json({ error: 'Room not in lobby' }, 409)
      const size = Number(b.wordPoolSize) as WordPoolSize
      if (!wordPoolSizes.has(size)) return json({ error: 'Invalid word pool' }, 400)
      s.wordPoolSize = size
      p.lastSeen = Date.now()
      await this.save(s)
      return json(s)
    }

    if (url.pathname === '/begin-jobs' && request.method === 'POST') {
      const b = (await request.json()) as { playerId?: string }
      const p = s.players.find((x) => x.id === b.playerId)
      if (!p?.host) return json({ error: 'Host only' }, 403)
      if (s.phase !== 'lobby') return json({ error: 'Room not in lobby' }, 409)
      if (s.players.length < 2) return json({ error: 'Need at least 2 players' }, 409)
      for (const x of s.players) x.jobId = undefined
      s.phase = 'jobs'
      s.jobsEndsAt = Date.now() + JOBS_MS
      await this.save(s)
      return json(s)
    }

    if (url.pathname === '/choose-job' && request.method === 'POST') {
      if (this.advanceTimeouts(s)) {
        await this.save(s)
        return json(s)
      }
      const b = (await request.json()) as { playerId?: string; jobId?: string }
      const p = s.players.find((x) => x.id === b.playerId)
      if (!p) return json({ error: 'Player not found' }, 404)
      if (s.phase !== 'jobs') return json({ error: 'Not choosing jobs' }, 409)
      if (!b.jobId || !jobs.has(b.jobId)) return json({ error: 'Invalid job' }, 400)
      if (s.players.some((x) => x.id !== p.id && x.jobId === b.jobId)) return json({ error: 'Profession already chosen' }, 409)
      p.jobId = b.jobId
      p.lastSeen = Date.now()
      if (s.players.every((x) => x.jobId)) this.startBattle(s)
      await this.save(s)
      return json(s)
    }

    if (url.pathname === '/start' && request.method === 'POST') {
      const b = (await request.json()) as { playerId?: string }
      const p = s.players.find((x) => x.id === b.playerId)
      if (!p?.host) return json({ error: 'Host only' }, 403)
      if (s.players.length < 2) return json({ error: 'Need at least 2 players' }, 409)
      this.fillRandomJobs(s)
      this.startBattle(s)
      await this.save(s)
      return json(s)
    }

    if (url.pathname === '/action' && request.method === 'POST') {
      if (this.advanceTimeouts(s)) {
        await this.save(s)
        return json(s)
      }
      if (s.phase !== 'battle' || s.battlePhase !== 'action') return json({ error: 'Not accepting actions' }, 409)
      const b = (await request.json()) as { playerId?: string; action?: ActionName }
      const p = s.players.find((x) => x.id === b.playerId)
      if (!p?.alive) return json({ error: 'Player not available' }, 404)
      if (!b.action || !actions.has(b.action)) return json({ error: 'Invalid action' }, 400)
      p.lastSeen = Date.now()
      p.action = b.action
      await this.save(s)
      return json(s)
    }

    if (url.pathname === '/answer' && request.method === 'POST') {
      if (this.advanceTimeouts(s)) {
        await this.save(s)
        return json(s)
      }
      if (s.phase !== 'battle' || s.battlePhase !== 'quiz') return json({ error: 'Not accepting answers' }, 409)
      const b = (await request.json()) as { playerId?: string; choice?: string }
      const p = s.players.find((x) => x.id === b.playerId)
      if (!p?.alive) return json({ error: 'Player not available' }, 404)
      if (p.answered) return json({ error: 'Already answered' }, 409)
      p.lastSeen = Date.now()
      const q = this.currentQuestion(s)
      const correct = b.choice === q.answer
      p.answered = true
      p.answerCorrect = correct
      p.coefficient = correct ? this.coefficientFromDeadline(s) : 0
      p.answeredAt = Date.now()
      await this.save(s)
      return json(s)
    }

    if (url.pathname === '/leave' && request.method === 'POST') {
      const b = (await request.json()) as { playerId?: string }
      s.players = s.players.filter((x) => x.id !== b.playerId)
      this.normalizeAfterLeave(s)
      await this.save(s)
      return json(s)
    }

    if (url.pathname === '/reset' && request.method === 'POST') {
      const b = (await request.json()) as { playerId?: string }
      const p = s.players.find((x) => x.id === b.playerId)
      if (!p?.host) return json({ error: 'Host only' }, 403)
      for (const x of s.players) {
        x.jobId = undefined
        x.hp = 100
        x.maxHp = 100
        x.atk = 10
        x.def = 5
        x.alive = true
        x.guard = false
        x.action = undefined
        x.answered = false
        x.coefficient = undefined
        x.answeredAt = undefined
        x.answerCorrect = undefined
        x.lastSeen = Date.now()
      }
      s.phase = 'jobs'
      s.battlePhase = 'action'
      s.jobsEndsAt = Date.now() + JOBS_MS
      s.round = 0
      s.log = []
      s.question = undefined
      s.actionEndsAt = undefined
      s.quizEndsAt = undefined
      s.resolveEndsAt = undefined
      s.resolveQueue = undefined
      s.resolveIndex = undefined
      s.currentResult = undefined
      await this.save(s)
      return json(s)
    }

    return json({ error: 'Not found' }, 404)
  }

  async alarm() {
    const s = await this.getState()
    const staleChanged = this.pruneStale(s)
    const timeoutChanged = this.advanceTimeouts(s)
    if (staleChanged || timeoutChanged || s.players.length) await this.save(s)
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === 'string' && message === 'ping') {
      const a = ws.deserializeAttachment() as { playerId?: string } | null
      const s = await this.getState()
      const p = s.players.find((x) => x.id === a?.playerId)
      if (p) {
        p.lastSeen = Date.now()
        await this.save(s)
      }
      ws.send('pong')
    }
  }

  async webSocketClose(ws: WebSocket) {
    const a = ws.deserializeAttachment() as { playerId?: string } | null
    if (!a?.playerId) return
    const s = await this.getState()
    if (s.players.some((p) => p.id === a.playerId)) {
      s.players = s.players.filter((p) => p.id !== a.playerId)
      this.normalizeAfterLeave(s)
      await this.save(s)
    }
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws)
  }
}
