import { useEffect, useMemo, useState, type ReactNode } from 'react'

type Page = 'home' | 'rooms' | 'lobby' | 'jobs' | 'battle' | 'result'
type BattlePhase = 'action' | 'quiz' | 'resolve'
type ActionName = '升級' | '攻擊' | '治療' | '尾刀' | '減傷'

type Job = {
  id: string
  name: string
  feature: string
  badge: string
}

type Fighter = {
  id: string
  name: string
  job: string
  hp: number
  maxHp: number
  atk: number
  def: number
  guard: boolean
}

type WordQuestion = {
  word: string
  answer: string
  choices: string[]
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

const actions: { name: ActionName; desc: string }[] = [
  { name: '升級', desc: '增加生命、攻擊、防禦' },
  { name: '攻擊', desc: '攻擊生命最多的玩家' },
  { name: '治療', desc: '恢復生命，滿血則增加上限' },
  { name: '尾刀', desc: '攻擊生命最少的玩家' },
  { name: '減傷', desc: '下一次被攻擊時降低傷害' },
]

const questions: WordQuestion[] = [
  { word: 'brave', answer: '勇敢的', choices: ['安靜的', '勇敢的', '飢餓的'] },
  { word: 'shield', answer: '盾牌', choices: ['盾牌', '箭矢', '城堡'] },
  { word: 'heal', answer: '治療', choices: ['逃跑', '攻擊', '治療'] },
  { word: 'victory', answer: '勝利', choices: ['失敗', '勝利', '危險'] },
  { word: 'enemy', answer: '敵人', choices: ['敵人', '朋友', '老師'] },
  { word: 'protect', answer: '保護', choices: ['保護', '破壞', '尋找'] },
  { word: 'strong', answer: '強壯的', choices: ['快速的', '疲累的', '強壯的'] },
  { word: 'attack', answer: '攻擊', choices: ['防守', '攻擊', '等待'] },
  { word: 'magic', answer: '魔法', choices: ['魔法', '盔甲', '道路'] },
  { word: 'survive', answer: '生存', choices: ['投降', '生存', '睡覺'] },
]

const botNames = ['英文字典王', '單字獵人']

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [name, setName] = useState(() => localStorage.getItem('hero-player-name') ?? '')
  const [roomId, setRoomId] = useState('')
  const [jobId, setJobId] = useState('')
  const [fighters, setFighters] = useState<Fighter[]>([])
  const [round, setRound] = useState(1)
  const [phase, setPhase] = useState<BattlePhase>('action')
  const [actionSeconds, setActionSeconds] = useState(5)
  const [quizSeconds, setQuizSeconds] = useState(8)
  const [selectedAction, setSelectedAction] = useState<ActionName | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answerLocked, setAnswerLocked] = useState(false)
  const [battleMessage, setBattleMessage] = useState('選擇本回合動作')

  const selectedRoom = useMemo(() => rooms.find((room) => room.id === roomId), [roomId])
  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId), [jobId])
  const me = fighters.find((fighter) => fighter.id === 'me')
  const activeQuestion = questions[questionIndex % questions.length]

  const enterGame = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    localStorage.setItem('hero-player-name', trimmedName)
    setName(trimmedName)
    setPage('rooms')
  }

  const startBattle = () => {
    setFighters([
      { id: 'me', name, job: selectedJob?.name ?? '勇者', hp: 100, maxHp: 100, atk: 10, def: 5, guard: false },
      { id: 'bot-1', name: botNames[0], job: '戰士', hp: 100, maxHp: 100, atk: 10, def: 5, guard: false },
      { id: 'bot-2', name: botNames[1], job: '弓箭手', hp: 100, maxHp: 100, atk: 10, def: 5, guard: false },
    ])
    setRound(1)
    setPhase('action')
    setActionSeconds(5)
    setQuizSeconds(8)
    setSelectedAction(null)
    setQuestionIndex(0)
    setAnswerLocked(false)
    setBattleMessage('選擇本回合動作')
    setPage('battle')
  }

  const chooseAction = (action: ActionName) => {
    if (phase !== 'action') return
    setSelectedAction(action)
    setPhase('quiz')
    setQuizSeconds(8)
    setAnswerLocked(false)
    setBattleMessage(`已選擇「${action}」，答對英文題目才能發動！`)
  }

  const answerQuestion = (choice: string) => {
    if (phase !== 'quiz' || answerLocked) return
    setAnswerLocked(true)
    if (choice !== activeQuestion.answer) {
      resolveTurn(0, '答錯了，本回合沒有動作。')
      return
    }

    const coefficient = quizSeconds >= 7 ? 4 : quizSeconds >= 5 ? 3 : quizSeconds >= 3 ? 2 : 1
    resolveTurn(coefficient, `答對！速度係數 ×${coefficient}`)
  }

  const resolveTurn = (coefficient: number, prefix: string) => {
    const action = selectedAction ?? '升級'
    let detail = ''

    setFighters((current) => {
      const next = current.map((fighter) => ({ ...fighter }))
      const self = next.find((fighter) => fighter.id === 'me')!
      const enemies = next.filter((fighter) => fighter.id !== 'me' && fighter.hp > 0)

      if (coefficient > 0) {
        const multiplier = getJobMultiplier(jobId, action)
        const effect = coefficient * multiplier

        if (action === '升級') {
          const hpGain = Math.round(4 * effect * (jobId === 'warrior' ? 1.5 : 1))
          const atkGain = Math.max(1, Math.round(effect * (jobId === 'assassin' ? 1.6 : 1)))
          const defGain = Math.max(1, Math.round(effect * (jobId === 'fighter' ? 1.6 : 1)))
          self.maxHp += hpGain
          self.hp += hpGain
          self.atk += atkGain
          self.def += defGain
          detail = `生命上限 +${hpGain}、攻擊 +${atkGain}、防禦 +${defGain}`
        }

        if ((action === '攻擊' || action === '尾刀') && enemies.length) {
          const target = [...enemies].sort((a, b) => action === '攻擊' ? b.hp - a.hp : a.hp - b.hp)[0]
          const baseDamage = self.atk * (action === '尾刀' ? 1.15 : 1)
          const rawDamage = Math.max(1, Math.round(baseDamage * effect - target.def))
          const damage = target.guard ? Math.max(1, Math.round(rawDamage * 0.5)) : rawDamage
          target.guard = false
          target.hp = Math.max(0, target.hp - damage)
          detail = `${action}命中 ${target.name}，造成 ${damage} 傷害`
        }

        if (action === '治療') {
          const heal = Math.round((12 + self.atk * 0.5) * effect)
          if (self.hp >= self.maxHp) {
            const maxGain = Math.max(1, Math.round(heal * 0.5))
            self.maxHp += maxGain
            self.hp += maxGain
            detail = `生命已滿，生命上限 +${maxGain}`
          } else {
            const before = self.hp
            self.hp = Math.min(self.maxHp, self.hp + heal)
            detail = `恢復 ${self.hp - before} 生命`
          }
        }

        if (action === '減傷') {
          self.guard = true
          detail = '獲得護盾：下一次攻擊傷害減半'
        }
      }

      // Prototype bots: each round they make one simple attack so HP/ranking can be tested.
      const livingBots = next.filter((fighter) => fighter.id !== 'me' && fighter.hp > 0)
      livingBots.forEach((bot) => {
        if (self.hp <= 0) return
        const raw = Math.max(1, bot.atk - Math.round(self.def * 0.55))
        const damage = self.guard ? Math.max(1, Math.round(raw * 0.5)) : raw
        self.guard = false
        self.hp = Math.max(0, self.hp - damage)
      })

      return next
    })

    setPhase('resolve')
    setBattleMessage(`${prefix}${detail ? ` ${detail}` : ''}`)
  }

  const nextRound = () => {
    const living = fighters.filter((fighter) => fighter.hp > 0)
    if (round >= 10 || living.length <= 1 || (me?.hp ?? 0) <= 0) {
      setPage('result')
      return
    }

    setRound((value) => value + 1)
    setQuestionIndex((value) => value + 1)
    setSelectedAction(null)
    setPhase('action')
    setActionSeconds(5)
    setQuizSeconds(8)
    setAnswerLocked(false)
    setBattleMessage('選擇本回合動作')
  }

  useEffect(() => {
    if (page !== 'battle' || phase !== 'action') return
    if (actionSeconds <= 0) {
      chooseAction('升級')
      return
    }
    const timer = window.setTimeout(() => setActionSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [page, phase, actionSeconds])

  useEffect(() => {
    if (page !== 'battle' || phase !== 'quiz' || answerLocked) return
    if (quizSeconds <= 0) {
      setAnswerLocked(true)
      resolveTurn(0, '時間到，本回合沒有動作。')
      return
    }
    const timer = window.setTimeout(() => setQuizSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [page, phase, quizSeconds, answerLocked])

  const speakWord = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(activeQuestion.word)
    utterance.lang = 'en-US'
    utterance.rate = 0.82
    window.speechSynthesis.speak(utterance)
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
              <span className="room-status">等待中 · 1/4</span>
            </button>
          ))}
        </div>
        <button className="primary-button" disabled={!roomId} onClick={() => setPage('lobby')} type="button">進入房間</button>
      </Screen>
    )
  }

  if (page === 'lobby') {
    return (
      <Screen title={selectedRoom?.name ?? '玩家大廳'} subtitle="2 人以上，房主即可開戰" onBack={() => setPage('rooms')}>
        <div className="player-list">
          <PlayerRow name={name} label="房主" />
          <PlayerRow name="英文字典王" label="測試玩家" />
          <PlayerRow name="等待玩家加入…" muted />
          <PlayerRow name="等待玩家加入…" muted />
        </div>
        <div className="notice-box">目前先用測試玩家完成完整戰鬥流程。Cloudflare 即時多人房間會在這版確認後接上。</div>
        <button className="primary-button" onClick={() => setPage('jobs')} type="button">開戰</button>
      </Screen>
    )
  }

  if (page === 'jobs') {
    return (
      <Screen title="選擇職業" subtitle="每個職業都有不同的戰鬥加成" onBack={() => setPage('lobby')}>
        <div className="job-grid">
          {jobs.map((job) => (
            <button key={job.id} className={`job-card ${jobId === job.id ? 'selected' : ''}`} onClick={() => setJobId(job.id)} type="button">
              <span className="job-avatar">{job.badge}</span>
              <strong>{job.name}</strong>
              <small>{job.feature}</small>
            </button>
          ))}
        </div>
        <button className="primary-button" disabled={!jobId} onClick={startBattle} type="button">確認職業</button>
      </Screen>
    )
  }

  if (page === 'battle') {
    return (
      <main className="battle-shell">
        {me && <SelfStatus fighter={me} />}

        <section className="enemy-strip">
          {fighters.filter((fighter) => fighter.id !== 'me').map((fighter) => <PlayerBattle key={fighter.id} fighter={fighter} />)}
        </section>

        <section className="battle-panel">
          <div className="battle-heading">
            <div><span className="mini-label">ROUND {round} / 10</span><h1>{phase === 'action' ? '選擇動作' : phase === 'quiz' ? '英文挑戰' : '行動結果'}</h1></div>
            <div className={`timer ${phase === 'quiz' ? 'quiz-timer' : ''}`}>{phase === 'action' ? actionSeconds : phase === 'quiz' ? quizSeconds : '✓'}</div>
          </div>

          {phase === 'action' && (
            <div className="action-grid">
              {actions.map((action) => (
                <button key={action.name} className="action-card" onClick={() => chooseAction(action.name)} type="button">
                  <strong>{action.name}</strong><small>{action.desc}</small>
                </button>
              ))}
            </div>
          )}

          {phase === 'quiz' && (
            <div className="quiz-card">
              <div className="word-line">
                <div><span className="mini-label">選擇：{selectedAction}</span><strong className="word">{activeQuestion.word}</strong></div>
                <button className="speak-button" type="button" onClick={speakWord}>🔊 發音</button>
              </div>
              <p className="quiz-help">選出正確中文意思。越快答對，行動係數越高。</p>
              <div className="answer-grid">
                {activeQuestion.choices.map((choice) => <button key={choice} type="button" disabled={answerLocked} onClick={() => answerQuestion(choice)}>{choice}</button>)}
              </div>
              <div className="score-guide"><span>7–8 秒 ×4</span><span>5–6 秒 ×3</span><span>3–4 秒 ×2</span><span>1–2 秒 ×1</span></div>
            </div>
          )}

          {phase === 'resolve' && (
            <div className="resolve-card">
              <strong>{battleMessage}</strong>
              <p>目前測試版的兩位電腦玩家也會在每輪攻擊你，用來確認生命值、護盾與 10 輪結算。</p>
              <button className="primary-button" type="button" onClick={nextRound}>{round >= 10 || (me?.hp ?? 0) <= 0 ? '查看排行榜' : '下一回合'}</button>
            </div>
          )}

          {phase !== 'resolve' && <p className="battle-message">{battleMessage}</p>}
        </section>
      </main>
    )
  }

  if (page === 'result') {
    const ranking = [...fighters].sort((a, b) => b.hp - a.hp)
    return (
      <Screen title="對戰結果" subtitle="10 輪結束或生命歸零後，依剩餘生命值排名" onBack={() => setPage('battle')}>
        <div className="ranking-list">
          {ranking.map((fighter, index) => (
            <div key={fighter.id} className={`rank-row ${index === 0 ? 'champion' : ''}`}>
              <b>{index + 1}</b><span>{fighter.name} · {fighter.job}</span><strong>HP {fighter.hp}</strong>
            </div>
          ))}
        </div>
        <button className="primary-button" onClick={() => { setPage('rooms'); setSelectedAction(null) }} type="button">再戰一場</button>
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
          <button className="line-button" type="button" onClick={() => alert('LINE Login 會在 Cloudflare 多人後端完成後串接。')}><span className="line-mark">LINE</span>使用 LINE 登入</button>
        </div>
        <p className="hint">先以名字進入遊戲；LINE 登入將在多人連線完成後開放。</p>
      </section>
    </main>
  )
}

function getJobMultiplier(jobId: string, action: ActionName) {
  if (jobId === 'archer' && action === '攻擊') return 1.6
  if (jobId === 'priest' && action === '治療') return 1.8
  if (jobId === 'assassin' && action === '升級') return 1.35
  if (jobId === 'warrior' && action === '升級') return 1.35
  if (jobId === 'fighter' && action === '升級') return 1.35
  return 1
}

function Screen({ title, subtitle, onBack, children }: { title: string; subtitle: string; onBack: () => void; children: ReactNode }) {
  return (
    <main className="page-shell">
      <section className="page-card">
        <button className="back-button" onClick={onBack} type="button">← 返回</button>
        <p className="eyebrow">HERO WORD BATTLE</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
        {children}
      </section>
    </main>
  )
}

function PlayerRow({ name, label, muted = false }: { name: string; label?: string; muted?: boolean }) {
  return <div className={`player-row ${muted ? 'muted' : ''}`}><span className="player-dot" /><strong>{name}</strong>{label && <em>{label}</em>}</div>
}

function SelfStatus({ fighter }: { fighter: Fighter }) {
  const percent = fighter.maxHp ? Math.max(0, Math.min(100, (fighter.hp / fighter.maxHp) * 100)) : 0
  return (
    <section className="status-card self-card">
      <div><span className="mini-label">YOU · {fighter.job}</span><h2>{fighter.name}</h2></div>
      <div className="stats"><span>HP {fighter.hp}/{fighter.maxHp}</span><span>ATK {fighter.atk}</span><span>DEF {fighter.def}</span>{fighter.guard && <span>🛡️ 減傷待命</span>}</div>
      <div className="hp-track"><span style={{ width: `${percent}%` }} /></div>
    </section>
  )
}

function PlayerBattle({ fighter }: { fighter: Fighter }) {
  const percent = fighter.maxHp ? Math.max(0, Math.min(100, (fighter.hp / fighter.maxHp) * 100)) : 0
  return (
    <div className={`enemy-card ${fighter.hp <= 0 ? 'muted' : ''}`}>
      <div><strong>{fighter.name}</strong><small>{fighter.job}</small></div>
      <span>HP {fighter.hp}/{fighter.maxHp}</span>
      <div className="mini-hp"><i style={{ width: `${percent}%` }} /></div>
    </div>
  )
}
