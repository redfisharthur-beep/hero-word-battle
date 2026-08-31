import { useMemo, useState } from 'react'

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

const actions = [
  ['升級', '增加生命、攻擊、防禦'],
  ['攻擊', '攻擊生命最多的玩家'],
  ['治療', '恢復生命，滿血則增加上限'],
  ['尾刀', '攻擊生命最少的玩家'],
  ['減傷', '下一次被攻擊時降低傷害'],
]

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [name, setName] = useState(() => localStorage.getItem('hero-player-name') ?? '')
  const [roomId, setRoomId] = useState('')
  const [jobId, setJobId] = useState('')
  const [selectedAction, setSelectedAction] = useState('')

  const selectedRoom = useMemo(() => rooms.find((room) => room.id === roomId), [roomId])
  const selectedJob = useMemo(() => jobs.find((job) => job.id === jobId), [jobId])

  const enterGame = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    localStorage.setItem('hero-player-name', trimmedName)
    setName(trimmedName)
    setPage('rooms')
  }

  if (page === 'rooms') {
    return (
      <Screen title="選擇決鬥房間" subtitle={`勇者 ${name}，選一座競技場加入`} onBack={() => setPage('home')}>
        <div className="room-grid">
          {rooms.map((room, index) => (
            <button
              key={room.id}
              className={`room-card ${roomId === room.id ? 'selected' : ''}`}
              onClick={() => setRoomId(room.id)}
              type="button"
            >
              <span className="room-number">0{index + 1}</span>
              <strong>{room.name}</strong>
              <small>{room.subtitle}</small>
              <span className="room-status">等待中 · 1/4</span>
            </button>
          ))}
        </div>
        <button className="primary-button" disabled={!roomId} onClick={() => setPage('lobby')} type="button">
          進入房間
        </button>
      </Screen>
    )
  }

  if (page === 'lobby') {
    return (
      <Screen title={selectedRoom?.name ?? '玩家大廳'} subtitle="2 人以上，房主即可開戰" onBack={() => setPage('rooms')}>
        <div className="player-list">
          <PlayerRow name={name} label="房主" />
          <PlayerRow name="等待玩家加入…" muted />
          <PlayerRow name="等待玩家加入…" muted />
          <PlayerRow name="等待玩家加入…" muted />
        </div>
        <div className="notice-box">目前示範階段先用假玩家資料。接上 Cloudflare 即時房間後，這裡會自動同步其他玩家。</div>
        <button className="primary-button" onClick={() => setPage('jobs')} type="button">
          模擬第 2 位玩家加入 → 開戰
        </button>
      </Screen>
    )
  }

  if (page === 'jobs') {
    return (
      <Screen title="選擇職業" subtitle="每個職業都有不同的戰鬥加成" onBack={() => setPage('lobby')}>
        <div className="job-grid">
          {jobs.map((job) => (
            <button
              key={job.id}
              className={`job-card ${jobId === job.id ? 'selected' : ''}`}
              onClick={() => setJobId(job.id)}
              type="button"
            >
              <span className="job-avatar">{job.badge}</span>
              <strong>{job.name}</strong>
              <small>{job.feature}</small>
            </button>
          ))}
        </div>
        <button className="primary-button" disabled={!jobId} onClick={() => setPage('battle')} type="button">
          確認職業
        </button>
      </Screen>
    )
  }

  if (page === 'battle') {
    return (
      <main className="battle-shell">
        <section className="status-card self-card">
          <div>
            <span className="mini-label">YOU · {selectedJob?.name}</span>
            <h2>{name}</h2>
          </div>
          <div className="stats"><span>HP 100/100</span><span>ATK 10</span><span>DEF 5</span></div>
          <div className="hp-track"><span style={{ width: '100%' }} /></div>
        </section>

        <section className="enemy-strip">
          <PlayerBattle name="英文字典王" hp="86/100" />
          <PlayerBattle name="單字獵人" hp="72/100" />
          <PlayerBattle name="等待玩家" hp="--" muted />
        </section>

        <section className="battle-panel">
          <div className="battle-heading">
            <div><span className="mini-label">ROUND 1 / 10</span><h1>選擇動作</h1></div>
            <div className="timer">5</div>
          </div>
          <div className="action-grid">
            {actions.map(([title, desc]) => (
              <button
                key={title}
                className={`action-card ${selectedAction === title ? 'selected' : ''}`}
                onClick={() => setSelectedAction(title)}
                type="button"
              >
                <strong>{title}</strong><small>{desc}</small>
              </button>
            ))}
          </div>
          <button className="primary-button" disabled={!selectedAction} onClick={() => setPage('result')} type="button">
            示範答題與結算
          </button>
        </section>
      </main>
    )
  }

  if (page === 'result') {
    return (
      <Screen title="對戰結果" subtitle="目前先完成流程骨架，之後接正式 10 輪戰鬥規則" onBack={() => setPage('battle')}>
        <div className="ranking-list">
          <div className="rank-row champion"><b>1</b><span>{name}</span><strong>HP 100</strong></div>
          <div className="rank-row"><b>2</b><span>英文字典王</span><strong>HP 86</strong></div>
          <div className="rank-row"><b>3</b><span>單字獵人</span><strong>HP 72</strong></div>
        </div>
        <button className="primary-button" onClick={() => { setPage('rooms'); setSelectedAction('') }} type="button">再戰一場</button>
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
          <input
            id="player-name"
            className="name-input"
            type="text"
            maxLength={12}
            placeholder="輸入你的名字"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && enterGame()}
          />
          <button className="primary-button" type="button" disabled={!name.trim()} onClick={enterGame}>開始冒險</button>
          <div className="divider"><span>或</span></div>
          <button className="line-button" type="button" onClick={() => alert('LINE Login 將在 Cloudflare 後端完成後串接。')}>
            <span className="line-mark">LINE</span>使用 LINE 登入
          </button>
        </div>
        <p className="hint">目前先用名字進入；LINE 登入會在多人房間完成後串接。</p>
      </section>
    </main>
  )
}

function Screen({ title, subtitle, onBack, children }: { title: string; subtitle: string; onBack: () => void; children: React.ReactNode }) {
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

function PlayerBattle({ name, hp, muted = false }: { name: string; hp: string; muted?: boolean }) {
  return <div className={`enemy-card ${muted ? 'muted' : ''}`}><strong>{name}</strong><span>HP {hp}</span></div>
}
