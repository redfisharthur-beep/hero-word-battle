const HERO_SRC='/music/hero.mp3'
const TRICK_SRC='/music/trick.mp3'
const BGM_SRC='/music/BGM.mp3'
const WRONG_SRC='/music/wrong.mp3'

let heroAudio:HTMLAudioElement|null=null
let trickAudio:HTMLAudioElement|null=null
let battleAudio:HTMLAudioElement|null=null
let wrongAudio:HTMLAudioElement|null=null
let unlocked=false
let lastUltimateKey=''
let battleBgmActive=false
let feedbackTimer:number|undefined

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
  if(!wrongAudio){
    wrongAudio=new Audio(WRONG_SRC)
    wrongAudio.preload='auto'
    wrongAudio.volume=.95
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

function playWrong(){
  ensureAudio()
  if(!wrongAudio)return
  wrongAudio.pause()
  wrongAudio.currentTime=0
  void wrongAudio.play().catch(()=>undefined)
}

function showCorrectAnswer(answer:string){
  document.getElementById('quiz-correct-feedback')?.remove()
  const box=document.createElement('div')
  box.id='quiz-correct-feedback'
  box.textContent=`正解為 ${answer}`
  Object.assign(box.style,{
    position:'fixed',left:'50%',top:'54%',transform:'translate(-50%,-50%) scale(.92)',
    zIndex:'99999',padding:'14px 24px',borderRadius:'18px',border:'2px solid rgba(255,210,70,.92)',
    background:'rgba(7,15,32,.96)',color:'#fff2a8',fontSize:'clamp(20px,5vw,30px)',fontWeight:'800',
    letterSpacing:'.04em',boxShadow:'0 0 28px rgba(255,80,40,.55)',pointerEvents:'none',opacity:'0',
    transition:'opacity .12s ease, transform .12s ease'
  } as Partial<CSSStyleDeclaration>)
  document.body.appendChild(box)
  requestAnimationFrame(()=>{box.style.opacity='1';box.style.transform='translate(-50%,-50%) scale(1)'})
  if(feedbackTimer)window.clearTimeout(feedbackTimer)
  feedbackTimer=window.setTimeout(()=>{
    box.style.opacity='0'
    box.style.transform='translate(-50%,-50%) scale(.96)'
    window.setTimeout(()=>box.remove(),180)
  },900)
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

  if(!battleBgmActive&&document.querySelector('.answer-choice.chosen')){
    startBattleBgm()
    return
  }

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

  const originalFetch=window.fetch.bind(window)
  window.fetch=async(...args)=>{
    const response=await originalFetch(...args)
    const url=typeof args[0]==='string'?args[0]:args[0] instanceof Request?args[0].url:String(args[0])
    if(url.includes('/answer')&&response.ok){
      void response.clone().json().then((data:{answerFeedback?:{correct?:boolean;correctAnswer?:string}})=>{
        const feedback=data?.answerFeedback
        if(feedback&&feedback.correct===false&&feedback.correctAnswer){
          playWrong()
          showCorrectAnswer(feedback.correctAnswer)
        }
      }).catch(()=>undefined)
    }
    return response
  }

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
    window.fetch=originalFetch
    heroAudio?.pause()
    trickAudio?.pause()
    battleAudio?.pause()
    wrongAudio?.pause()
    if(feedbackTimer)window.clearTimeout(feedbackTimer)
    document.getElementById('quiz-correct-feedback')?.remove()
    for(const event of events)window.removeEventListener(event,unlockAudio)
  }
}
