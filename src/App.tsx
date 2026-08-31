import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  connectRoom,
  hasMultiplayerApi,
  multiplayerApi,
  type RemoteAction,
  type RemoteRoomState,
} from './lib/multiplayer'
import './job-images.css'

type Page = 'home' | 'rooms' | 'lobby' | 'jobs' | 'battle' | 'result'
type Job = { id: string; name: string; feature: string; badge: string }
type EffectKind = 'hit' | 'heal' | 'ko' | 'buff'
type RemotePlayer = RemoteRoomState['players'][number]

const rooms = [
  { id: 'sword', name: '聖劍試煉場', subtitle: '勇者們以榮耀決勝' },
  { id: 'shadow', name: '影刃競技廳', subtitle: '速度與判斷的對決' },
  { id: 'bow', name: '蒼弓決鬥域', subtitle: '遠距決勝的戰場' },
  { id: 'oracle', name: '神諭聖堂', subtitle: '智慧與意志的終局' },
]

const jobs: Job[] = [
  { id: 'assassin', name: '刺客', feature: '升級時，攻擊增幅最多', badge: 'ATK' },
  { id: 'warrior', name: '戰士', feature: '升級時，血量增幅最多', badge: 'HP' },
  { id: 'fighter', name: '武道家', feature: '升級時，防禦增幅最多', badge: 'DEF' },
  { id: 'archer', name: '弓箭手', feature: '選擇攻擊時，輸出最高', badge: 'DMG' },
  { id: 'priest', name: '牧師', feature: '選擇治療時，恢復最多', badge: 'HEAL' },
  { id: 'mage', name: '法師', feature: '選擇攻擊時，對全體敵人造成少量範圍傷害', badge: 'AOE' },
]

const actions: { id: RemoteAction; name: string; icon: string; desc: string }[] = [
  { id: 'upgrade', name: '升級', icon: '✦', desc: '增加生命、攻擊、防禦' },
  { id: 'attack', name: '攻擊', icon: '⚔', desc: '攻擊生命最多的玩家' },
  { id: 'heal', name: '治療', icon: '✚', desc: '恢復生命，滿血則增加上限' },
  { id: 'finish', name: '尾刀', icon: '➶', desc: '攻擊生命最少的玩家' },
  { id: 'guard', name: '減傷', icon: '◆', desc: '下一次被攻擊時降低傷害' },
]

const fallbackQuestion = { id: 0, word: 'brave', choices: ['安靜的', '勇敢的', '飢餓的'] }
const jobName = (jobId?: string) => jobs.find((job) => job.id === jobId)?.name ?? '尚未選擇'
const jobImage = (jobId?: string) => jobId ? `/images/jobs/${jobId === 'mage' ? 'Mage' : jobId}.png` : ''
const jobHeadImage = (jobId?: string) => jobId ? `/images/jobs/${jobId === 'mage' ? 'Magehead' : `${jobId}head`}.png` : ''
const roomImage = (id?: string) => id === 'sword' ? '/images/rooms/Holy%20Sword.png' : id === 'shadow' ? '/images/rooms/Shadow%20Blade.png' : id === 'bow' ? '/images/rooms/Azure%20Bow.png' : id === 'oracle' ? '/images/rooms/Oracle.png' : ''
const phasePage = (state: RemoteRoomState): Page => state.phase === 'battle' ? 'battle' : state.phase === 'result' ? 'result' : state.phase === 'jobs' ? 'jobs' : 'lobby'

const createDemoState = (name: string, roomId: string): RemoteRoomState => ({
  roomId, phase: 'lobby', battlePhase: 'action', round: 0, questionIndex: 0,
  players: [
    { id: 'demo-me', name, host: true, hp: 100, maxHp: 100, atk: 10, def: 5, alive: true, guard: false },
    { id: 'demo-bot', name: '英文字典王', host: false, jobId: 'warrior', hp: 100, maxHp: 100, atk: 10, def: 5, alive: true, guard: false },
  ], log: [],
})

export default function App() {
  const online = hasMultiplayerApi()
  const [page, setPage] = useState<Page>('home')
  const [name, setName] = useState(() => localStorage.getItem('hero-player-name') ?? '')
  const [roomId, setRoomId] = useState('')
  const [playerId, setPlayerId] = useState(() => localStorage.getItem('hero-player-id') ?? '')
  const [roomState, setRoomState] = useState<RemoteRoomState | null>(null)
  const [jobId, setJobId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(true)
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({})
  const [clock, setClock] = useState(Date.now())
  const [effects, setEffects] = useState<Record<string, EffectKind>>({})
  const restoredRef = useRef(false)
  const tickRef = useRef('')
  const autoStartRef = useRef('')
  const previousHpRef = useRef<Record<string, { hp: number; alive: boolean }>>({})

  const selectedRoom = useMemo(() => rooms.find((room) => room.id === roomId), [roomId])
  const me = roomState?.players.find((player) => player.id === playerId)
  const question = roomState?.question ?? fallbackQuestion
  const livingPlayers = roomState?.players.filter((player) => player.alive) ?? []
  const sortedResults = [...(roomState?.players ?? [])].sort((a, b) => b.hp - a.hp || b.maxHp - a.maxHp || b.atk - a.atk || b.def - a.def)
  const deadline = roomState?.battlePhase === 'quiz' ? roomState.quizEndsAt : roomState?.actionEndsAt
  const remainingSeconds = deadline ? Math.max(0, Math.ceil((deadline - clock) / 1000)) : roomState?.battlePhase === 'quiz' ? 8 : 5
  const latestLog = roomState?.log.at(-1) ?? ''

  useEffect(() => {
    if (!online || !roomId || !playerId) return
    return connectRoom(roomId, setRoomState, setConnected)
  }, [online, roomId, playerId])

  useEffect(() => {
    if (roomState) setPage(phasePage(roomState))
  }, [roomState?.phase])

  useEffect(() => {
    if (!online || restoredRef.current) return
    restoredRef.current = true
    const savedRoom = localStorage.getItem('hero-room-id')
    const savedName = localStorage.getItem('hero-player-name')
    const savedPlayer = localStorage.getItem('hero-player-id')
    if (!savedRoom || !savedName || !savedPlayer) return
    setBusy(true)
    multiplayerApi.join(savedRoom, savedName, savedPlayer)
      .then(({ playerId: restoredPlayer, state }) => {
        setRoomId(savedRoom); setPlayerId(restoredPlayer); setRoomState(state)
        setJobId(state.players.find((p) => p.id === restoredPlayer)?.jobId ?? '')
        setPage(phasePage(state))
      })
      .catch(() => localStorage.removeItem('hero-room-id'))
      .finally(() => setBusy(false))
  }, [online])

  useEffect(() => {
    if (!online || page !== 'rooms') return
    let cancelled = false
    const load = async () => {
      const entries = await Promise.all(rooms.map(async (room) => {
        try { return [room.id, (await multiplayerApi.state(room.id)).players.length] as const }
        catch { return [room.id, 0] as const }
      }))
      if (!cancelled) setRoomCounts(Object.fromEntries(entries))
    }
    void load()
    const timer = window.setInterval(() => void load(), 3000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [online, page])

  useEffect(() => {
    if (page !== 'battle') return
    const timer = window.setInterval(() => setClock(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [page])

  useEffect(() => {
    if (!online || page !== 'battle' || !roomState || !deadline || remainingSeconds > 0) return
    const key = `${roomState.round}-${roomState.battlePhase}-${deadline}`
    if (tickRef.current === key) return
    tickRef.current = key
    void multiplayerApi.tick(roomId).then(setRoomState).catch(() => undefined)
  }, [online, page, roomState?.round, roomState?.battlePhase, deadline, remainingSeconds, roomId])

  useEffect(() => {
    if (!online || page !== 'jobs' || roomState?.phase !== 'jobs' || !me?.host || busy) return
    const ready = roomState.players.length >= 2 && roomState.players.every((p) => p.jobId)
    if (!ready) return
    const key = `${roomId}:${roomState.players.map((p) => `${p.id}:${p.jobId}`).join('|')}`
    if (autoStartRef.current === key) return
    autoStartRef.current = key
    void multiplayerApi.start(roomId, playerId).then(setRoomState).catch((err) => setError(err instanceof Error ? err.message : '開戰失敗'))
  }, [online, page, roomState, me?.host, busy, roomId, playerId])

  useEffect(() => {
    if (!roomState) return
    const previous = previousHpRef.current
    const nextPrevious: Record<string, { hp: number; alive: boolean }> = {}
    const changed: Record<string, EffectKind> = {}
    for (const player of roomState.players) {
      const old = previous[player.id]
      if (old) {
        if (old.alive && !player.alive) changed[player.id] = 'ko'
        else if (player.hp < old.hp) changed[player.id] = 'hit'
        else if (player.hp > old.hp) changed[player.id] = 'heal'
      }
      nextPrevious[player.id] = { hp: player.hp, alive: player.alive }
    }
    previousHpRef.current = nextPrevious
    if (Object.keys(changed).length) {
      setEffects(changed)
      const timer = window.setTimeout(() => setEffects({}), 700)
      return () => window.clearTimeout(timer)
    }
  }, [roomState?.players.map((p) => `${p.id}:${p.hp}:${p.alive}`).join('|')])

  const run = async (task: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await task() }
    catch (err) { setError(err instanceof Error ? err.message : '連線發生錯誤') }
    finally { setBusy(false) }
  }

  const enterGame = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    localStorage.setItem('hero-player-name', trimmed)
    setName(trimmed); setPage('rooms')
  }

  const enterRoom = async (nextRoomId = roomId) => {
    if (!nextRoomId || busy) return
    setRoomId(nextRoomId)
    if (!online) {
      const demo = createDemoState(name, nextRoomId); setPlayerId('demo-me'); setRoomState(demo); setPage('lobby'); return
    }
    await run(async () => {
      const joined = await multiplayerApi.join(nextRoomId, name, playerId || undefined)
      setPlayerId(joined.playerId); setRoomState(joined.state); setPage(phasePage(joined.state))
      localStorage.setItem('hero-player-id', joined.playerId)
      localStorage.setItem('hero-room-id', nextRoomId)
    })
  }

  const chooseJob = async (nextJobId: string) => {
    setJobId(nextJobId)
    if (!roomState) return
    if (!online) {
      const nextState = { ...roomState, phase: 'battle' as const, battlePhase: 'action' as const, round: 1, actionEndsAt: Date.now() + 5000, players: roomState.players.map((p) => p.id === playerId ? { ...p, jobId: nextJobId } : p), log: ['本機示範模式'] }
      setRoomState(nextState); setPage('battle'); return
    }
    await run(async () => setRoomState(await multiplayerApi.chooseJob(roomId, playerId, nextJobId)))
  }

  const submitAction = async (action: RemoteAction) => {
    if (!roomState || me?.action) return
    if (!online) {
      setRoomState({ ...roomState, battlePhase: 'quiz', actionEndsAt: undefined, quizEndsAt: Date.now() + 8000, question: fallbackQuestion, players: roomState.players.map((p) => p.id === playerId ? { ...p, action } : { ...p, action: 'attack' }) }); return
    }
    try { setRoomState(await multiplayerApi.action(roomId, playerId, action)) }
    catch (err) { setError(err instanceof Error ? err.message : '動作送出失敗') }
  }

  const submitAnswer = async (choice: string) => {
    if (!roomState || me?.answered) return
    const coefficient = remainingSeconds >= 7 ? 4 : remainingSeconds >= 5 ? 3 : remainingSeconds >= 3 ? 2 : remainingSeconds >= 1 ? 1 : 0
    if (!online) {
      const correct = choice === '勇敢的'; const damage = correct ? 8 * coefficient : 0
      const nextPlayers = roomState.players.map((p) => p.id === 'demo-bot' ? { ...p, hp: Math.max(0, p.hp - damage), alive: p.hp - damage > 0 } : p)
      const done = roomState.round >= 10 || nextPlayers.filter((p) => p.alive).length <= 1
      setRoomState({ ...roomState, phase: done ? 'result' : 'battle', battlePhase: 'action', round: done ? roomState.round : roomState.round + 1, actionEndsAt: done ? undefined : Date.now() + 5000, quizEndsAt: undefined, players: nextPlayers.map((p) => ({ ...p, action: undefined, answered: false, coefficient: undefined })), question: undefined, log: [...roomState.log, correct ? `答對！造成 ${damage} 傷害` : '答錯，本回合沒有動作。'] })
      return
    }
    try { setRoomState(await multiplayerApi.answer(roomId, playerId, choice, coefficient)) }
    catch (err) { setError(err instanceof Error ? err.message : '答案送出失敗') }
  }

  const speakWord = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(question.word); utterance.lang = 'en-US'; utterance.rate = .82
    window.speechSynthesis.speak(utterance)
  }

  const leaveRoom = async () => {
    if (online && roomId && playerId) { try { await multiplayerApi.leave(roomId, playerId) } catch { /* best effort */ } }
    localStorage.removeItem('hero-room-id')
    setRoomState(null); setRoomId(''); setJobId(''); setPage('rooms')
  }

  if (page === 'rooms') {
    return <main className="page-shell rooms-page"><section className="page-card rooms-card"><button className="back-button" onClick={() => setPage('home')} type="button">← 返回</button><div className="room-grid">{rooms.map((room) => {
      const count = roomCounts[room.id] ?? 0
      return <button key={room.id} className="room-card" onClick={() => void enterRoom(room.id)} type="button" disabled={busy || (online && count >= 4)} aria-label={room.name} />
    })}</div><ErrorBox text={error} /></section></main>
  }

  if (page === 'lobby') {
    const players = roomState?.players ?? []
    return <main className="page-shell lobby-page"><section className="page-card lobby-card">
      <button className="back-button" onClick={() => void leaveRoom()} type="button">← 返回</button>
      <img className="lobby-room-image" src={roomImage(roomId)} alt={selectedRoom?.name ?? '房間'} />
      <div className="player-list lobby-player-list">{players.map((p) => <PlayerRow key={p.id} player={p} label={p.host ? '房主' : undefined} />)}{Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => <PlayerRow key={i} name="等待玩家加入…" muted />)}</div>
      <ErrorBox text={error} />
      <button className="primary-button lobby-start-button" disabled={players.length < 2} onClick={() => setPage('jobs')} type="button">開戰</button>
    </section></main>
  }

  if (page === 'jobs') {
    return <Screen title="選擇職業" subtitle="選好職業後將自動開始對戰" onBack={() => setPage('lobby')}>
      <div className="job-grid">{jobs.map((job) => <button key={job.id} className={`job-card job-art-card ${(me?.jobId ?? jobId) === job.id ? 'selected' : ''}`} onClick={() => void chooseJob(job.id)} type="button" disabled={busy}><img className="job-full-art" src={jobImage(job.id)} alt={job.name} /><div className="job-card-copy"><span className="job-power-badge">{job.badge}</span><strong>{job.name}</strong><small>{job.feature}</small></div></button>)}</div>
      <ErrorBox text={error} />
    </Screen>
  }

  if (page === 'battle' && roomState) {
    const myEffect = me ? effects[me.id] : undefined
    return <main className="battle-shell">
      <ConnectionBar connected={connected} />
      <section className={`status-card self-card character-status-card ${myEffect ? `fx-${myEffect}` : ''}`}>
        <CharacterHead player={me} size="large" />
        <div className="character-status-body"><div className="self-top"><div><span className="mini-label">YOU · {jobName(me?.jobId)}</span><h2>{me?.name ?? name}</h2></div><span className={`alive-badge ${me?.alive ? '' : 'down'}`}>{me?.alive ? '戰鬥中' : '已擊倒'}</span></div>
        <div className="stats"><span>HP {me?.hp ?? 0}/{me?.maxHp ?? 100}</span><span>ATK {me?.atk ?? 10}</span><span>DEF {me?.def ?? 5}</span>{me?.guard && <span>🛡 減傷</span>}</div>
        <div className="hp-track"><span style={{ width: `${Math.max(0, Math.min(100, ((me?.hp ?? 0) / Math.max(1, me?.maxHp ?? 100)) * 100))}%` }} /></div></div>
      </section>
      <section className="enemy-strip">{roomState.players.filter((p) => p.id !== playerId).map((p) => <PlayerBattle key={p.id} player={p} effect={effects[p.id]} />)}</section>
      <section className="battle-panel">
        <div className="battle-heading"><div><span className="mini-label">ROUND {roomState.round} / 10 · {livingPlayers.length} 人存活</span><h1>{roomState.battlePhase === 'quiz' ? '英文挑戰' : '選擇動作'}</h1></div><div className={`timer ${remainingSeconds <= 2 ? 'danger' : ''}`}>{remainingSeconds}</div></div>
        {roomState.battlePhase === 'action' && me?.alive && <><div className="action-grid">{actions.map((action) => <button key={action.id} className={`action-card ${me.action === action.id ? 'selected' : ''}`} disabled={Boolean(me.action)} onClick={() => void submitAction(action.id)} type="button"><span className="action-icon">{action.icon}</span><strong>{action.name}</strong><small>{action.desc}</small></button>)}</div>{me.action && <div className="notice-box">動作已鎖定，等待其他玩家。</div>}</>}
        {roomState.battlePhase === 'quiz' && me?.alive && <div className="quiz-card"><div className="word-line"><div><span className="mini-label">LISTEN & CHOOSE</span><strong className="word">{question.word}</strong></div><button className="speak-button" type="button" onClick={speakWord}>🔊 發音</button></div><p className="quiz-help">越快答對，技能效果越強。</p><div className="score-guide"><span>7–8 秒 ×4</span><span>5–6 秒 ×3</span><span>3–4 秒 ×2</span><span>1–2 秒 ×1</span></div><div className="answer-grid">{question.choices.map((choice) => <button key={choice} type="button" disabled={Boolean(me.answered) || remainingSeconds <= 0} onClick={() => void submitAnswer(choice)}>{choice}</button>)}</div>{me.answered && <div className="notice-box">答案已送出，等待其他玩家。</div>}</div>}
        {!me?.alive && <div className="notice-box">你已被擊倒，可以觀看剩餘玩家完成對戰。</div>}
        {latestLog && <div className={`action-banner ${latestLog.includes('擊倒') ? 'ko-banner' : ''}`}>{latestLog}</div>}
        <ErrorBox text={error} />
        {roomState.log.length > 1 && <div className="battle-log">{roomState.log.slice(-5).reverse().map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>}
      </section>
    </main>
  }

  if (page === 'result') {
    return <Screen title="對戰結果" subtitle="排行榜依剩餘生命值決定" onBack={() => void leaveRoom()}>
      <div className="ranking-list">{sortedResults.map((p, index) => <div key={p.id} className={`rank-row rank-with-head ${index === 0 ? 'champion' : ''}`}><b>{index + 1}</b><CharacterHead player={p} /><span className="rank-player-copy"><strong>{p.name}</strong><small>{jobName(p.jobId)}</small></span><strong>HP {p.hp}</strong></div>)}</div>
      {me?.host && online ? <button className="primary-button" type="button" onClick={() => void run(async () => { const state = await multiplayerApi.reset(roomId, playerId); setRoomState(state); setPage('jobs') })}>再戰一場</button> : <button className="primary-button" type="button" onClick={() => void leaveRoom()}>返回房間選擇</button>}
    </Screen>
  }

  return <main className="app-shell"><section className="hero-card"><p className="eyebrow">ENGLISH WORD BATTLE</p><h1>勇者</h1><p className="subtitle">2～4 人英文單字對戰遊戲</p><div className="login-panel"><label className="field-label" htmlFor="player-name">勇者名稱</label><input id="player-name" className="name-input" type="text" maxLength={12} placeholder="輸入你的名字" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && enterGame()} /><div className="divider"><span>或</span></div><button className="line-button" type="button" onClick={() => alert('LINE Login 將於核心遊戲完成後串接。')}><span className="line-mark">LINE</span>使用 LINE 登入</button></div><button className="primary-button" type="button" disabled={!name.trim()} onClick={enterGame} aria-label="開始冒險，選擇房間">開始冒險</button><p className="hint">{online ? 'Cloudflare 即時多人模式已啟用。' : '本機示範模式'}</p></section></main>
}

function Screen({ title, subtitle, onBack, children }: { title: string; subtitle: string; onBack: () => void; children: ReactNode }) {
  return <main className="page-shell"><section className="page-card"><button className="back-button" onClick={onBack} type="button">← 返回</button><p className="eyebrow">HERO WORD BATTLE</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p>{children}</section></main>
}

function ConnectionBar({ connected }: { connected: boolean }) {
  return <div className={`connection-bar ${connected ? 'online' : 'offline'}`}><span />{connected ? '即時連線中' : '連線中斷，正在自動重連…'}</div>
}

function CharacterHead({ player, size = 'small' }: { player?: RemotePlayer; size?: 'small' | 'large' }) {
  if (!player?.jobId) return <span className={`character-head-placeholder ${size}`} />
  return <img className={`character-head ${size}`} src={jobHeadImage(player.jobId)} alt={jobName(player.jobId)} />
}

function PlayerRow({ player, name, label, muted = false }: { player?: RemotePlayer; name?: string; label?: string; muted?: boolean }) {
  return <div className={`player-row player-row-with-head ${muted ? 'muted' : ''}`}>{player ? <CharacterHead player={player} /> : <span className="player-dot" />}<strong>{player?.name ?? name}</strong>{label && <em>{label}</em>}</div>
}

function PlayerBattle({ player, effect }: { player: RemotePlayer; effect?: EffectKind }) {
  const hpPercent = Math.max(0, Math.min(100, player.hp / Math.max(1, player.maxHp) * 100))
  return <div className={`enemy-card enemy-card-with-head ${!player.alive ? 'muted' : ''} ${effect ? `fx-${effect}` : ''}`}><CharacterHead player={player} /><div><strong>{player.name}</strong><small>{jobName(player.jobId)}</small></div><span>{player.alive ? `HP ${player.hp}/${player.maxHp}` : 'K.O.'}</span><div className="mini-hp"><i style={{ width: `${hpPercent}%` }} /></div></div>
}

function ErrorBox({ text }: { text: string }) { return text ? <div className="notice-box">⚠️ {text}</div> : null }
