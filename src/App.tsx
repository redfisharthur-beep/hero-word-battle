import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  connectRoom,
  hasMultiplayerApi,
  multiplayerApi,
  type RemoteAction,
  type RemoteRoomState,
} from './lib/multiplayer'

type Page = 'home' | 'rooms' | 'lobby' | 'jobs' | 'battle' | 'result'

type Job = {
  id: string
  name: string
  feature: string
  badge: string
}

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
]

const actions: { id: RemoteAction; name: string; desc: string }[] = [
  { id: 'upgrade', name: '升級', desc: '增加生命、攻擊、防禦' },
  { id: 'attack', name: '攻擊', desc: '攻擊生命最多的玩家' },
  { id: 'heal', name: '治療', desc: '恢復生命，滿血則增加上限' },
  { id: 'finish', name: '尾刀', desc: '攻擊生命最少的玩家' },
  { id: 'guard', name: '減傷', desc: '下一次被攻擊時降低傷害' },
]

const fallbackQuestion = {
  id: 0,
  word: 'brave',
  choices: ['安靜的', '勇敢的', '飢餓的'],
}

const jobName = (jobId?: string) => jobs.find((job) => job.id === jobId)?.name ?? '尚未選擇'

const createDemoState = (name: string, roomId: string): RemoteRoomState => ({
  roomId,
  phase: 'lobby',
  battlePhase: 'action',
  round: 0,
  questionIndex: 0,
  players: [
    { id: 'demo-me', name, host: true, hp: 100, maxHp: 100, atk: 10, def: 5, alive: true, guard: false },
    { id: 'demo-bot', name: '英文字典王', host: false, jobId: 'warrior', hp: 100, maxHp: 100, atk: 10, def: 5, alive: true, guard: false },
  ],
  log: [],
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
  const [actionSeconds, setActionSeconds] = useState(5)
  const [quizSeconds, setQuizSeconds] = useState(8)

  const selectedRoom = useMemo(() => rooms.find((room) => room.id === roomId), [roomId])
  const me = roomState?.players.find((player) => player.id === playerId)
  const question = roomState?.question ?? fallbackQuestion
  const livingPlayers = roomState?.players.filter((player) => player.alive) ?? []
  const sortedResults = [...(roomState?.players ?? [])].sort((a, b) => b.hp - a.hp || b.maxHp - a.maxHp || b.atk - a.atk || b.def - a.def)

  useEffect(() => {
    if (!online || !roomId || !playerId) return
    return connectRoom(roomId, (nextState) => setRoomState(nextState))
  }, [online, roomId, playerId])

  useEffect(() => {
    if (!roomState) return
    if (roomState.phase === 'battle') setPage('battle')
    if (roomState.phase === 'result') setPage('result')
  }, [roomState?.phase])

  useEffect(() => {
    if (page !== 'battle' || roomState?.battlePhase !== 'action' || !me?.alive || me.action) return
    setActionSeconds(5)
    const timer = window.setInterval(() => {
      setActionSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer)
          void submitAction('upgrade')
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [page, roomState?.round, roomState?.battlePhase, me?.action, me?.alive])

  useEffect(() => {
    if (page !== 'battle' || roomState?.battlePhase !== 'quiz' || !me?.alive || me.answered) return
    setQuizSeconds(8)
    const timer = window.setInterval(() => {
      setQuizSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer)
          void submitAnswer('__timeout__', 0)
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [page, roomState?.round, roomState?.battlePhase, me?.answered, me?.alive])

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (err) {
      setError(err instanceof Error ? err.message : '連線發生錯誤')
    } finally {
      setBusy(false)
    }
  }

  const enterGame = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    localStorage.setItem('hero-player-name', trimmedName)
    setName(trimmedName)
    setPage('rooms')
  }

  const enterRoom = async () => {
    if (!roomId) return
    if (!online) {
      const demo = createDemoState(name, roomId)
      setPlayerId('demo-me')
      setRoomState(demo)
      setPage('lobby')
      return
    }

    await run(async () => {
      const joined = await multiplayerApi.join(roomId, name, playerId || undefined)
      setPlayerId(joined.playerId)
      localStorage.setItem('hero-player-id', joined.playerId)
      setRoomState(joined.state)
      setPage(joined.state.phase === 'jobs' ? 'jobs' : 'lobby')
    })
  }

  const chooseJob = async (nextJobId: string) => {
    setJobId(nextJobId)
    if (!roomState) return

    if (!online) {
      setRoomState({
        ...roomState,
        phase: 'jobs',
        players: roomState.players.map((player) => player.id === playerId ? { ...player, jobId: nextJobId } : player),
      })
      return
    }

    await run(async () => {
      setRoomState(await multiplayerApi.chooseJob(roomId, playerId, nextJobId))
    })
  }

  const startBattle = async () => {
    if (!roomState) return
    if (!online) {
      setRoomState({ ...roomState, phase: 'battle', battlePhase: 'action', round: 1, log: ['本機示範模式：多人同步需部署 Cloudflare。'] })
      setPage('battle')
      return
    }

    await run(async () => {
      setRoomState(await multiplayerApi.start(roomId, playerId))
    })
  }

  const submitAction = async (action: RemoteAction) => {
    if (!roomState || me?.action) return
    if (!online) {
      setRoomState({ ...roomState, battlePhase: 'quiz', question: fallbackQuestion, players: roomState.players.map((p) => p.id === playerId ? { ...p, action } : p) })
      return
    }
    try {
      setRoomState(await multiplayerApi.action(roomId, playerId, action))
    } catch (err) {
      setError(err instanceof Error ? err.message : '動作送出失敗')
    }
  }

  const submitAnswer = async (choice: string, coefficient: number) => {
    if (!roomState || me?.answered) return
    if (!online) {
      const correct = choice === '勇敢的'
      const damage = correct ? 8 * coefficient : 0
      const nextPlayers = roomState.players.map((p) => p.id === 'demo-bot' ? { ...p, hp: Math.max(0, p.hp - damage), alive: p.hp - damage > 0 } : p)
      const done = roomState.round >= 10 || nextPlayers.filter((p) => p.alive).length <= 1
      setRoomState({
        ...roomState,
        phase: done ? 'result' : 'battle',
        battlePhase: 'action',
        round: done ? roomState.round : roomState.round + 1,
        players: nextPlayers.map((p) => ({ ...p, action: undefined, answered: false, coefficient: undefined })),
        question: undefined,
        log: [...roomState.log, correct ? `答對！造成 ${damage} 傷害` : '答錯，本回合沒有動作。'],
      })
      if (done) setPage('result')
      return
    }

    try {
      setRoomState(await multiplayerApi.answer(roomId, playerId, choice, coefficient))
    } catch (err) {
      setError(err instanceof Error ? err.message : '答案送出失敗')
    }
  }

  const speakWord = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(question.word)
    utterance.lang = 'en-US'
    utterance.rate = 0.82
    window.speechSynthesis.speak(utterance)
  }

  const leaveRoom = async () => {
    if (online && roomId && playerId) {
      try { await multiplayerApi.leave(roomId, playerId) } catch { /* best effort */ }
    }
    setRoomState(null)
    setRoomId('')
    setJobId('')
    setPage('rooms')
  }

  if (page === 'rooms') {
    return (
      <Screen title="選擇決鬥房間" subtitle={`勇者 ${name}，選一座競技場加入`} onBack={() => setPage('home')}>
        <div className="room-grid">
          {rooms.map((room, index) => (
            <button key={room.id} className={`room-card ${roomId === room.id ? 'selected' : ''}`} onClick={() => setRoomId(room.id)} type="button">
              <span className="room-number">0{index + 1}</span>
              <strong>{room.name}</strong>
              <small>{room.subtitle}</small>
              <span className="room-status">{online ? '即時多人房間' : '本機測試模式'}</span>
            </button>
          ))}
        </div>
        <ErrorBox text={error} />
        <button className="primary-button" disabled={!roomId || busy} onClick={() => void enterRoom()} type="button">{busy ? '連線中…' : '進入房間'}</button>
      </Screen>
    )
  }

  if (page === 'lobby') {
    const players = roomState?.players ?? []
    return (
      <Screen title={selectedRoom?.name ?? '玩家大廳'} subtitle="2 人以上，選完職業後由房主開戰" onBack={() => void leaveRoom()}>
        <div className="player-list">
          {players.map((player) => <PlayerRow key={player.id} name={player.name} label={player.host ? '房主' : undefined} />)}
          {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, index) => <PlayerRow key={index} name="等待玩家加入…" muted />)}
        </div>
        <div className="notice-box">目前 {players.length}/4 人。{players.length < 2 ? '至少需要 2 位玩家。' : '人數已足夠，可以前往選擇職業。'}</div>
        <ErrorBox text={error} />
        <button className="primary-button" disabled={players.length < 2} onClick={() => setPage('jobs')} type="button">選擇職業</button>
      </Screen>
    )
  }

  if (page === 'jobs') {
    const everyoneReady = (roomState?.players.length ?? 0) >= 2 && roomState?.players.every((player) => player.jobId)
    return (
      <Screen title="選擇職業" subtitle="所有玩家選完職業後，由房主開戰" onBack={() => setPage('lobby')}>
        <div className="job-grid">
          {jobs.map((job) => (
            <button key={job.id} className={`job-card ${(me?.jobId ?? jobId) === job.id ? 'selected' : ''}`} onClick={() => void chooseJob(job.id)} type="button" disabled={busy}>
              <span className="job-avatar">{job.badge}</span>
              <strong>{job.name}</strong>
              <small>{job.feature}</small>
            </button>
          ))}
        </div>
        <div className="player-list">
          {(roomState?.players ?? []).map((player) => <PlayerRow key={player.id} name={player.name} label={player.jobId ? jobName(player.jobId) : '選擇中'} />)}
        </div>
        <ErrorBox text={error} />
        {me?.host ? (
          <button className="primary-button" disabled={!everyoneReady || busy} onClick={() => void startBattle()} type="button">{everyoneReady ? '開戰' : '等待所有玩家選完職業'}</button>
        ) : (
          <div className="notice-box">職業已選好後，等待房主開戰。</div>
        )}
      </Screen>
    )
  }

  if (page === 'battle' && roomState) {
    return (
      <main className="battle-shell">
        <section className="status-card self-card">
          <div><span className="mini-label">YOU · {jobName(me?.jobId)}</span><h2>{me?.name ?? name}</h2></div>
          <div className="stats"><span>HP {me?.hp ?? 0}/{me?.maxHp ?? 100}</span><span>ATK {me?.atk ?? 10}</span><span>DEF {me?.def ?? 5}</span>{me?.guard && <span>🛡️ 減傷</span>}</div>
          <div className="hp-track"><span style={{ width: `${Math.max(0, Math.min(100, ((me?.hp ?? 0) / Math.max(1, me?.maxHp ?? 100)) * 100))}%` }} /></div>
        </section>

        <section className="enemy-strip">
          {roomState.players.filter((player) => player.id !== playerId).map((player) => (
            <PlayerBattle key={player.id} name={`${player.name} · ${jobName(player.jobId)}`} hp={`${player.hp}/${player.maxHp}`} muted={!player.alive} />
          ))}
        </section>

        <section className="battle-panel">
          <div className="battle-heading">
            <div><span className="mini-label">ROUND {roomState.round} / 10 · {livingPlayers.length} 人存活</span><h1>{roomState.battlePhase === 'quiz' ? '英文挑戰' : '選擇動作'}</h1></div>
            <div className="timer">{roomState.battlePhase === 'quiz' ? quizSeconds : actionSeconds}</div>
          </div>

          {roomState.battlePhase === 'action' && me?.alive && (
            <>
              <div className="action-grid">
                {actions.map((action) => (
                  <button key={action.id} className={`action-card ${me.action === action.id ? 'selected' : ''}`} disabled={Boolean(me.action)} onClick={() => void submitAction(action.id)} type="button">
                    <strong>{action.name}</strong><small>{action.desc}</small>
                  </button>
                ))}
              </div>
              {me.action && <div className="notice-box">動作已鎖定，等待其他玩家。</div>}
            </>
          )}

          {roomState.battlePhase === 'quiz' && me?.alive && (
            <div className="quiz-card">
              <button className="sound-button" type="button" onClick={speakWord}>🔊 發音</button>
              <div className="word-display">{question.word}</div>
              <div className="coefficient-hint">剩 7–8 秒 ×4　5–6 秒 ×3　3–4 秒 ×2　1–2 秒 ×1</div>
              <div className="choice-grid">
                {question.choices.map((choice) => (
                  <button key={choice} type="button" disabled={Boolean(me.answered)} onClick={() => {
                    const coefficient = quizSeconds >= 7 ? 4 : quizSeconds >= 5 ? 3 : quizSeconds >= 3 ? 2 : 1
                    void submitAnswer(choice, coefficient)
                  }}>{choice}</button>
                ))}
              </div>
              {me.answered && <div className="notice-box">答案已送出，等待其他玩家。</div>}
            </div>
          )}

          {!me?.alive && <div className="notice-box">你已被擊倒，可以觀看剩餘玩家完成對戰。</div>}
          <ErrorBox text={error} />
          {roomState.log.length > 0 && <div className="battle-log">{roomState.log.slice(-5).map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}</div>}
        </section>
      </main>
    )
  }

  if (page === 'result') {
    return (
      <Screen title="對戰結果" subtitle="排行榜依剩餘生命值決定" onBack={() => setPage('rooms')}>
        <div className="ranking-list">
          {sortedResults.map((player, index) => (
            <div key={player.id} className={`rank-row ${index === 0 ? 'champion' : ''}`}><b>{index + 1}</b><span>{player.name} · {jobName(player.jobId)}</span><strong>HP {player.hp}</strong></div>
          ))}
        </div>
        {me?.host && online ? (
          <button className="primary-button" type="button" onClick={() => void run(async () => { setRoomState(await multiplayerApi.reset(roomId, playerId)); setPage('jobs') })}>再戰一場</button>
        ) : (
          <button className="primary-button" type="button" onClick={() => setPage('rooms')}>返回房間選擇</button>
        )}
      </Screen>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">ENGLISH WORD BATTLE</p>
        <h1>勇者</h1>
        <p className="subtitle">2～4 人英文單字對戰遊戲</p>
        <div className="login-panel">
          <label className="field-label" htmlFor="player-name">勇者名稱</label>
          <input id="player-name" className="name-input" type="text" maxLength={12} placeholder="輸入你的名字" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && enterGame()} />
          <button className="primary-button" type="button" disabled={!name.trim()} onClick={enterGame}>開始冒險</button>
          <div className="divider"><span>或</span></div>
          <button className="line-button" type="button" onClick={() => alert('LINE Login 會在多人版穩定後串接。')}><span className="line-mark">LINE</span>使用 LINE 登入</button>
        </div>
        <p className="hint">{online ? 'Cloudflare 即時多人模式已啟用。' : '目前為本機示範模式；部署 Cloudflare 後會自動切換即時多人。'}</p>
      </section>
    </main>
  )
}

function Screen({ title, subtitle, onBack, children }: { title: string; subtitle: string; onBack: () => void; children: ReactNode }) {
  return (
    <main className="page-shell"><section className="page-card"><button className="back-button" onClick={onBack} type="button">← 返回</button><p className="eyebrow">HERO WORD BATTLE</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p>{children}</section></main>
  )
}

function PlayerRow({ name, label, muted = false }: { name: string; label?: string; muted?: boolean }) {
  return <div className={`player-row ${muted ? 'muted' : ''}`}><span className="player-dot" /><strong>{name}</strong>{label && <em>{label}</em>}</div>
}

function PlayerBattle({ name, hp, muted = false }: { name: string; hp: string; muted?: boolean }) {
  return <div className={`enemy-card ${muted ? 'muted' : ''}`}><strong>{name}</strong><span>HP {hp}</span></div>
}

function ErrorBox({ text }: { text: string }) {
  return text ? <div className="notice-box">⚠️ {text}</div> : null
}
