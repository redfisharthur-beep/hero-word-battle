const HERO_SRC='/music/hero.mp3'
const TRICK_SRC='/music/trick.mp3'
const BGM_SRC='/music/BGM.mp3'

let heroAudio:HTMLAudioElement|null=null
let trickAudio:HTMLAudioElement|null=null
let battleAudio:HTMLAudioElement|null=null
let unlocked=false
let lastUltimateKey=''
let battleBgmActive=false

function isHeroPage(){
  return Boolean(document.querySelector('.app-shell,.rooms-page,.lobby-page,.jobs-page,.result-page'))&&!document.querySelector('.battle-shell')
}

function isBattlePage(){
  return Boolean(document.querySelector('.battle-shell'))
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
  if(!battleAudio){
    battleAudio=new Audio(BGM_SRC)
    battleAudio.loop=true
    battleAudio.preload='auto'
    battleAudio.volume=.5
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

function startBattleBgm(){
  ensureAudio()
  if(!battleAudio||battleBgmActive||!isBattlePage())return
  battleBgmActive=true
  battleAudio.currentTime=0
  void battleAudio.play().catch(()=>undefined)
}

function stopBattleBgm(){
  if(!battleAudio)return
  battleBgmActive=false
  battleAudio.pause()
  battleAudio.currentTime=0
}

function syncBattleBgm(){
  ensureAudio()

  if(!isBattlePage()){
    if(battleBgmActive)stopBattleBgm()
    return
  }

  /* Start only after this player has completed all 3 quiz questions.
     If everyone finishes together and the UI has already entered resolve,
     start there as the same end-of-quiz moment. */
  if(!battleBgmActive&&(document.querySelector('.quiz-card.quiz-complete')||document.querySelector('.resolve-panel'))){
    startBattleBgm()
    return
  }

  /* Keep playing through resolution; stop after choosing the next round action. */
  if(battleBgmActive&&document.querySelector('.action-card.selected')){
    stopBattleBgm()
  }
}

function unlockAudio(){
  if(!unlocked)unlocked=true
  if(battleBgmActive&&battleAudio?.paused)void battleAudio.play().catch(()=>undefined)
  else void tryPlayHero()
}

export function installGameAudio(){
  ensureAudio()
  syncHero()
  syncUltimateSound()
  syncBattleBgm()

  const observer=new MutationObserver(()=>{
    syncHero()
    syncUltimateSound()
    syncBattleBgm()
  })
  observer.observe(document.getElementById('root')??document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})

  const events:['pointerdown','touchstart','keydown']=['pointerdown','touchstart','keydown']
  for(const event of events)window.addEventListener(event,unlockAudio,{passive:true,once:false})

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      heroAudio?.pause()
      battleAudio?.pause()
    }else{
      syncHero()
      if(battleBgmActive)void battleAudio?.play().catch(()=>undefined)
    }
  })

  return()=>{
    observer.disconnect()
    heroAudio?.pause()
    trickAudio?.pause()
    battleAudio?.pause()
    for(const event of events)window.removeEventListener(event,unlockAudio)
  }
}
