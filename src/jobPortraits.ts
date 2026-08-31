const PORTRAITS: Record<string, string> = {
  '刺客': '/images/job-heads/assassin.png',
  '戰士': '/images/job-heads/warrior.png',
  '武道家': '/images/job-heads/fighter.png',
  '弓箭手': '/images/job-heads/archer.png',
  '牧師': '/images/job-heads/priest.png',
}

const portraitForText = (text = '') => {
  const entry = Object.entries(PORTRAITS).find(([job]) => text.includes(job))
  return entry?.[1]
}

const mountPortrait = (target: Element, className: string) => {
  if (target.querySelector(':scope > .job-portrait')) return
  const src = portraitForText(target.textContent ?? '')
  if (!src) return

  const img = document.createElement('img')
  img.className = `job-portrait ${className}`
  img.src = src
  img.alt = ''
  img.decoding = 'async'
  img.loading = 'eager'
  img.onerror = () => img.remove()
  target.prepend(img)
}

const decorate = () => {
  document.querySelectorAll('.player-row').forEach((el) => mountPortrait(el, 'job-portrait-row'))
  document.querySelectorAll('.self-card').forEach((el) => mountPortrait(el, 'job-portrait-self'))
  document.querySelectorAll('.enemy-card').forEach((el) => mountPortrait(el, 'job-portrait-enemy'))
  document.querySelectorAll('.rank-row').forEach((el) => mountPortrait(el, 'job-portrait-rank'))
}

export function installJobPortraits() {
  decorate()
  const observer = new MutationObserver(decorate)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  return () => observer.disconnect()
}
