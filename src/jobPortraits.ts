const statIcon = (kind: 'life' | 'atk' | 'def') => `/images/actions/${kind === 'life' ? 'life' : kind === 'atk' ? 'ATK' : 'DEF'}.png`

const makeStat = (kind: 'life' | 'atk' | 'def', value: string) => {
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

const decorateSelfStats = () => {
  document.querySelectorAll('.self-card .stats').forEach((stats) => {
    const spans = Array.from(stats.children).filter((el): el is HTMLElement => el instanceof HTMLElement)
    const specs: Array<{ index: number; kind: 'life' | 'atk' | 'def'; pattern: RegExp }> = [
      { index: 0, kind: 'life', pattern: /HP\s+([^\s]+)/i },
      { index: 1, kind: 'atk', pattern: /ATK\s+([^\s]+)/i },
      { index: 2, kind: 'def', pattern: /DEF\s+([^\s]+)/i },
    ]

    for (const { index, kind, pattern } of specs) {
      const target = spans[index]
      if (!target || target.querySelector('.stat-icon')) continue
      const match = (target.textContent ?? '').match(pattern)
      if (!match) continue
      target.replaceChildren(...Array.from(makeStat(kind, match[1]).childNodes))
      target.classList.add('stat-pill', `stat-${kind}`)
    }
  })
}

const decorateEnemyStats = () => {
  document.querySelectorAll<HTMLElement>('.enemy-card .enemy-stats').forEach((stats) => {
    if (stats.querySelector('.stat-icon')) return
    const text = stats.textContent ?? ''
    const life = text.match(/HP\s+([^\s　]+)/i)?.[1]
    const atk = text.match(/ATK\s+([^\s　]+)/i)?.[1]
    const def = text.match(/DEF\s+([^\s　]+)/i)?.[1]
    if (!life || !atk || !def) return

    const guard = text.includes('減傷待命') || text.includes('減傷')
    stats.textContent = ''
    stats.classList.add('stat-strip')
    stats.append(makeStat('life', life), makeStat('atk', atk), makeStat('def', def))
    if (guard) {
      const guardMark = document.createElement('span')
      guardMark.className = 'stat-guard'
      guardMark.textContent = '減傷'
      stats.append(guardMark)
    }
  })
}

const removeLegacyPortraits = () => {
  document.querySelectorAll('.job-portrait').forEach((el) => el.remove())
}

const decorate = () => {
  removeLegacyPortraits()
  decorateSelfStats()
  decorateEnemyStats()
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
