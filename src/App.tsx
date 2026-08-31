import { useState } from 'react'

export default function App() {
  const [name, setName] = useState('')

  const handleStart = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    localStorage.setItem('hero-player-name', trimmedName)
    alert(`歡迎，${trimmedName}！下一步會進入房間選擇。`)
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">ENGLISH WORD BATTLE</p>
        <h1>勇者</h1>
        <p className="subtitle">2～4 人英文單字對戰遊戲</p>

        <div className="login-panel">
          <label className="field-label" htmlFor="player-name">
            勇者名稱
          </label>
          <input
            id="player-name"
            className="name-input"
            type="text"
            maxLength={12}
            placeholder="輸入你的名字"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleStart()
            }}
          />

          <button
            className="primary-button"
            type="button"
            disabled={!name.trim()}
            onClick={handleStart}
          >
            開始冒險
          </button>

          <div className="divider"><span>或</span></div>

          <button
            className="line-button"
            type="button"
            onClick={() => alert('LINE 登入會在後續串接 LINE Login。')}
          >
            <span className="line-mark">LINE</span>
            使用 LINE 登入
          </button>
        </div>

        <p className="hint">輸入名字即可先開始，LINE 登入之後再正式串接。</p>
      </section>
    </main>
  )
}
