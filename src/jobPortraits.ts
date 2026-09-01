const statIcon = (kind: 'life' | 'atk' | 'def') => `/images/actions/${kind === 'life' ? 'life' : kind === 'atk' ? 'ATK' : 'DEF'}.png`

type StatKind = 'life' | 'atk' | 'def'

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
  const life = text.match(/HP\s+([0-9]+(?:\/[0-9]+)?)/i)?.[1]
  const atk = text.match(/ATK\s+([0-9]+)/i)?.[1]
  const def = text.match(/DEF\s+([0-9]+)/i)?.[1]
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

const removeLegacyPortraits = () => {
  document.querySelectorAll('.job-portrait').forEach((el) => el.remove())
}

const decorate = () => {
  removeLegacyPortraits()
  syncSelfProfession()
  syncStats()
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
