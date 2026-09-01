const statIcon = (kind: 'life' | 'atk' | 'def') => `/images/actions/${kind === 'life' ? 'life' : kind === 'atk' ? 'ATK' : 'DEF'}.png`

type StatKind = 'life' | 'atk' | 'def'
type MatchStat = { correct: number; total: number; damage: number; healing: number }

const matchStats = new Map<string, MatchStat>()
const seenResultCapsules = new WeakSet<Element>()

const makeStat = (kind: StatKind, value: string) => {
  const wrap = document.createElement('span')
  wrap.className = `stat-pill stat-${kind}`

  const img = document.createElement('img')
  img.className = 'stat-icon'
  img.src = statIcon(kind)
  img.alt = kind === 'life' ? '生命' : kind === 'atk' ? '攻擊' : '防禦'
  img.decoding = 'async'
  img.loading = 'eager'

  const number = document.createElement('b')
  number.className = 'stat-number'
  number.textContent = value

  wrap.append(img, number)
  return wrap
}

const parseStats = (text: string) => {
  const life = text.match(/HP\s+([^\s　]+)/i)?.[1]
  const atk = text.match(/ATK\s+(\d+)/i)?.[1]
  const def = text.match(/DEF\s+(\d+)/i)?.[1]
  return life && atk && def ? { life, atk, def } : null
}

const syncStrip = (source: HTMLElement, host: HTMLElement) => {
  const values = parseStats(source.textContent ?? '')
  if (!values) return

  let strip = host.querySelector(':scope > .live-stat-strip') as HTMLElement | null
  if (!strip) {
    strip = document.createElement('div')
    strip.className = 'live-stat-strip'
    host.append(strip)
  }

  const signature = `${values.life}|${values.atk}|${values.def}`
  if (strip.dataset.signature === signature) return
  strip.dataset.signature = signature
  strip.replaceChildren(
    makeStat('life', values.life),
    makeStat('atk', values.atk),
    makeStat('def', values.def),
  )
}

const syncSelfProfession = () => {
  document.querySelectorAll<HTMLElement>('.self-card .self-top > div').forEach((host) => {
    const source = host.querySelector<HTMLElement>('.mini-label')
    if (!source) return
    const profession = (source.textContent ?? '').replace(/^YOU\s*·\s*/i, '').trim()
    if (!profession) return

    let label = host.querySelector<HTMLElement>(':scope > .self-job-label')
    if (!label) {
      label = document.createElement('span')
      label.className = 'self-job-label'
      host.insertBefore(label, host.querySelector('h2'))
    }
    if (label.textContent !== profession) label.textContent = profession
  })
}

const syncStats = () => {
  document.querySelectorAll<HTMLElement>('.self-card .stats').forEach((source) => {
    const host = source.parentElement
    if (host) syncStrip(source, host)
  })

  document.querySelectorAll<HTMLElement>('.enemy-card .enemy-stats').forEach((source) => {
    const host = source.parentElement
    if (host) syncStrip(source, host)
  })
}

const collectBattleResults = () => {
  document.querySelectorAll<HTMLElement>('.result-capsule:not(.waiting)').forEach((capsule) => {
    if (seenResultCapsules.has(capsule)) return
    seenResultCapsules.add(capsule)

    const playerName = capsule.querySelector<HTMLElement>('.result-actor-copy > strong')?.textContent?.trim()
    if (!playerName) return

    const stat = matchStats.get(playerName) ?? { correct: 0, total: 0, damage: 0, healing: 0 }
    stat.total += 1
    if (capsule.classList.contains('correct')) stat.correct += 1

    let hpLoss = 0
    let hpGain = 0
    capsule.querySelectorAll<HTMLElement>('.result-change-chip span').forEach((span) => {
      const match = (span.textContent ?? '').match(/^HP\s+([+-]?\d+)/i)
      if (!match) return
      const amount = Number(match[1])
      if (amount < 0) hpLoss += Math.abs(amount)
      if (amount > 0) hpGain += amount
    })
    stat.damage += hpLoss

    const profession = capsule.querySelector<HTMLElement>('.result-actor-copy > small')?.textContent?.trim() ?? ''
    const isHealingAction = capsule.classList.contains('result-heal') || (capsule.classList.contains('result-ultimate') && profession === '牧師')
    if (isHealingAction) stat.healing += hpGain

    matchStats.set(playerName, stat)
  })
}

const decorateRanking = () => {
  const ranking = document.querySelector<HTMLElement>('.ranking-list')
  if (!ranking) return

  ranking.closest('.page-card')?.classList.add('final-ranking-card')
  const medals = ['🥇', '🥈', '🥉']

  ranking.querySelectorAll<HTMLElement>('.rank-row').forEach((row, index) => {
    const copy = row.querySelector<HTMLElement>('.rank-player-copy')
    const nameNode = copy?.querySelector<HTMLElement>('strong')
    if (!copy || !nameNode) return
    const playerName = nameNode.textContent?.trim() ?? ''
    const stat = matchStats.get(playerName) ?? { correct: 0, total: 0, damage: 0, healing: 0 }
    const accuracy = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0

    const oldRank = row.querySelector<HTMLElement>(':scope > b')
    if (oldRank) oldRank.style.display = 'none'

    let medal = copy.querySelector<HTMLElement>(':scope > .rank-medal')
    if (!medal) {
      medal = document.createElement('span')
      medal.className = 'rank-medal'
      copy.insertBefore(medal, nameNode)
    }
    medal.textContent = medals[index] ?? `${index + 1}`

    let details = row.querySelector<HTMLElement>(':scope > .rank-match-stats')
    if (!details) {
      details = document.createElement('div')
      details.className = 'rank-match-stats'
      row.append(details)
    }
    details.innerHTML = `<span>答對率 <b>${accuracy}%</b></span><span>輸出傷害 <b>${stat.damage}</b></span><span>治療量 <b>${stat.healing}</b></span>`

    const directStrong = Array.from(row.children).find((el) => el.tagName === 'STRONG') as HTMLElement | undefined
    if (directStrong) directStrong.style.display = 'none'
  })
}

const resetStatsOnWaitingScreens = () => {
  if (document.querySelector('.jobs-page') || document.querySelector('.lobby-page')) matchStats.clear()
}

const removeLegacyPortraits = () => {
  document.querySelectorAll('.job-portrait').forEach((el) => el.remove())
}

const decorate = () => {
  resetStatsOnWaitingScreens()
  removeLegacyPortraits()
  syncSelfProfession()
  syncStats()
  collectBattleResults()
  decorateRanking()
}

export function installJobPortraits() {
  decorate()
  let queued = false
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    queueMicrotask(() => {
      queued = false
      decorate()
    })
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  return () => observer.disconnect()
}
