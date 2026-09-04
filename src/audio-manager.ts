const HERO_SRC='/music/hero.mp3'
const TRICK_SRC='/music/trick.mp3'

let heroAudio:HTMLAudioElement|null=null
let trickAudio:HTMLAudioElement|null=null
let unlocked=false
let lastUltimateKey=''

function isHeroPage(){
  return Boolean(document.querySelector('.app-shell,.rooms-page,.lobby-page,.jobs-page,.result-page'))&&!document.querySelector('.battle-shell')
}

function ensureAudio(){
  if(!heroAudio){
    heroAudio=new Audio(HERO_SRC)
    heroAudio.loop=true
    heroAudio.preload='auto'
    heroAudio.volume=.42
  }
  if(!trickAudio){
    trickAudio=new Audio(TRICK_SRC)
    trickAudio.preload='auto'
    trickAudio.volume=.9
  }
}

async function tryPlayHero(){
  ensureAudio()
  if(!heroAudio)return
  if(!isHeroPage()){
    heroAudio.pause()
    return
  }
  try{
    await heroAudio.play()
    unlocked=true
  }catch{
    // Browsers may block audible autoplay until the first user gesture.
  }
}

function syncHero(){
  ensureAudio()
  if(!heroAudio)return
  if(isHeroPage())void tryPlayHero()
  else heroAudio.pause()
}

function playTrick(){
  ensureAudio()
  if(!trickAudio)return
  trickAudio.pause()
  trickAudio.currentTime=0
  void trickAudio.play().catch(()=>undefined)
}

function syncUltimateSound(){
  const capsule=document.querySelector<HTMLElement>('.result-capsule.result-ultimate')
  if(!capsule)return
  const key=capsule.getAttribute('key')||capsule.dataset.comfortUltimate||capsule.textContent||''
  if(capsule.dataset.trickPlayed==='1'||key===lastUltimateKey)return
  capsule.dataset.trickPlayed='1'
  lastUltimateKey=key
  playTrick()
}

function unlockAudio(){
  if(unlocked)return
  unlocked=true
  void tryPlayHero()
}

export function installGameAudio(){
  ensureAudio()
  syncHero()
  syncUltimateSound()

  const observer=new MutationObserver(()=>{
    syncHero()
    syncUltimateSound()
  })
  observer.observe(document.getElementById('root')??document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})

  const events:['pointerdown','touchstart','keydown']=['pointerdown','touchstart','keydown']
  for(const event of events)window.addEventListener(event,unlockAudio,{passive:true,once:false})

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)heroAudio?.pause()
    else syncHero()
  })

  return()=>{
    observer.disconnect()
    heroAudio?.pause()
    trickAudio?.pause()
    for(const event of events)window.removeEventListener(event,unlockAudio)
  }
}
