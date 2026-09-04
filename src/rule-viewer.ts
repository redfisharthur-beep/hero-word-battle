const RULE_BUTTON_ID='game-rule-button'
const RULE_MODAL_ID='game-rule-modal'
const RULE_IMAGES=['/images/jobs/rule1.png','/images/jobs/rule2.png','/images/jobs/rule3.png']

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))

function ensureStyles(){
 if(document.getElementById('game-rule-viewer-styles'))return
 const style=document.createElement('style')
 style.id='game-rule-viewer-styles'
 style.textContent=`
#${RULE_BUTTON_ID}{position:fixed;right:max(3vw,calc((100vw - 520px)/2 + 8px));top:10px;z-index:80;width:112px;height:56px;min-width:112px;max-width:112px;min-height:56px;max-height:56px;margin:0;padding:0;border:0;border-radius:0;outline:0;background:transparent url('/images/rooms/rule.png') center/contain no-repeat;box-shadow:none;font-size:0;color:transparent;cursor:pointer;touch-action:manipulation}
#${RULE_BUTTON_ID}:hover{transform:none;filter:brightness(1.08)}
#${RULE_BUTTON_ID}:active{transform:scale(.96)}
#${RULE_MODAL_ID}{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:rgba(2,6,23,.96);overscroll-behavior:contain}
#${RULE_MODAL_ID}[hidden]{display:none!important}
#${RULE_MODAL_ID} .rule-toolbar{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:1fr auto auto auto auto auto;gap:8px;align-items:center;padding:10px 12px;background:rgba(2,6,23,.92);border-bottom:1px solid rgba(255,255,255,.12);backdrop-filter:blur(10px)}
#${RULE_MODAL_ID} .rule-title{font-size:18px;font-weight:700;color:#f8fafc;white-space:nowrap}
#${RULE_MODAL_ID} .rule-tool{width:44px;min-width:44px;height:44px;min-height:44px;padding:0;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(30,41,59,.9);color:#fff;font-size:22px;font-weight:700;display:grid;place-items:center;cursor:pointer}
#${RULE_MODAL_ID} .rule-close{font-size:26px;background:rgba(127,29,29,.72)}
#${RULE_MODAL_ID} .rule-zoom-label{min-width:58px;text-align:center;color:#e2e8f0;font-size:14px;font-variant-numeric:tabular-nums}
#${RULE_MODAL_ID} .rule-scroll{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;overscroll-behavior:contain;background:#050914}
#${RULE_MODAL_ID} .rule-stage{width:100%;min-height:100%;padding:14px 0 40px;display:flex;flex-direction:column;align-items:center;gap:0}
#${RULE_MODAL_ID} .rule-image{display:block;height:auto;max-width:none;margin:0 auto;border:0;box-shadow:none;user-select:none;-webkit-user-drag:none;transform-origin:top center}
@media(max-width:760px){#${RULE_BUTTON_ID}{right:3vw;top:10px;width:112px;height:56px;min-width:112px;max-width:112px;min-height:56px;max-height:56px}#${RULE_MODAL_ID} .rule-toolbar{grid-template-columns:1fr auto auto auto auto auto;gap:6px;padding:max(8px,env(safe-area-inset-top)) 8px 8px}#${RULE_MODAL_ID} .rule-title{font-size:15px}#${RULE_MODAL_ID} .rule-tool{width:38px;min-width:38px;height:38px;min-height:38px;border-radius:10px;font-size:20px}#${RULE_MODAL_ID} .rule-zoom-label{min-width:44px;font-size:12px}}
`
 document.head.appendChild(style)
}

function createViewer(){
 let modal=document.getElementById(RULE_MODAL_ID) as HTMLDivElement|null
 if(modal)return modal
 modal=document.createElement('div')
 modal.id=RULE_MODAL_ID
 modal.hidden=true
 modal.setAttribute('role','dialog')
 modal.setAttribute('aria-modal','true')
 modal.setAttribute('aria-label','遊戲說明')
 modal.innerHTML=`<div class="rule-toolbar"><div class="rule-title">遊戲說明</div><button class="rule-tool rule-minus" type="button" aria-label="縮小">−</button><div class="rule-zoom-label">100%</div><button class="rule-tool rule-plus" type="button" aria-label="放大">＋</button><button class="rule-tool rule-reset" type="button" aria-label="恢復大小">↺</button><button class="rule-tool rule-close" type="button" aria-label="關閉">×</button></div><div class="rule-scroll"><div class="rule-stage"></div></div>`
 const stage=modal.querySelector('.rule-stage') as HTMLDivElement
 for(const [index,src] of RULE_IMAGES.entries()){
  const img=document.createElement('img')
  img.className='rule-image'
  img.src=src
  img.alt=`遊戲規則 ${index+1}`
  img.draggable=false
  stage.appendChild(img)
 }
 document.body.appendChild(modal)

 const scroll=modal.querySelector('.rule-scroll') as HTMLDivElement
 const label=modal.querySelector('.rule-zoom-label') as HTMLDivElement
 let zoom=1
 let pinchStartDistance=0
 let pinchStartZoom=1
 const applyZoom=()=>{
  const width=`${Math.round(zoom*100)}%`
  for(const img of Array.from(modal!.querySelectorAll<HTMLImageElement>('.rule-image')))img.style.width=width
  label.textContent=`${Math.round(zoom*100)}%`
 }
 const setZoom=(next:number)=>{zoom=clamp(next,.5,3);applyZoom()}
 const close=()=>{modal!.hidden=true;document.body.style.overflow='';setZoom(1);scroll.scrollTo({top:0,left:0})}
 const open=()=>{modal!.hidden=false;document.body.style.overflow='hidden';setZoom(1);scroll.scrollTo({top:0,left:0});(modal!.querySelector('.rule-close') as HTMLButtonElement).focus()}
 ;(modal.querySelector('.rule-minus') as HTMLButtonElement).addEventListener('click',()=>setZoom(zoom-.25))
 ;(modal.querySelector('.rule-plus') as HTMLButtonElement).addEventListener('click',()=>setZoom(zoom+.25))
 ;(modal.querySelector('.rule-reset') as HTMLButtonElement).addEventListener('click',()=>{setZoom(1);scroll.scrollTo({top:0,left:0,behavior:'smooth'})})
 ;(modal.querySelector('.rule-close') as HTMLButtonElement).addEventListener('click',close)
 modal.addEventListener('keydown',event=>{if(event.key==='Escape')close()})
 scroll.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();setZoom(zoom+(event.deltaY<0?.15:-.15))},{passive:false})
 scroll.addEventListener('dblclick',()=>setZoom(zoom===1?2:1))
 scroll.addEventListener('touchstart',event=>{if(event.touches.length===2){pinchStartDistance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);pinchStartZoom=zoom}},{passive:true})
 scroll.addEventListener('touchmove',event=>{if(event.touches.length!==2||!pinchStartDistance)return;event.preventDefault();const distance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);setZoom(pinchStartZoom*(distance/pinchStartDistance))},{passive:false})
 scroll.addEventListener('touchend',()=>{pinchStartDistance=0},{passive:true})
 applyZoom()
 ;(modal as HTMLDivElement & {openRuleViewer?:()=>void}).openRuleViewer=open
 return modal
}

function syncRuleButton(){
 const roomsCard=document.querySelector('.rooms-page .rooms-card')
 const existing=document.getElementById(RULE_BUTTON_ID)
 if(!roomsCard){existing?.remove();return}
 if(existing)return
 const viewer=createViewer() as HTMLDivElement & {openRuleViewer?:()=>void}
 const button=document.createElement('button')
 button.id=RULE_BUTTON_ID
 button.type='button'
 button.setAttribute('aria-label','遊戲說明')
 button.title='遊戲說明'
 button.addEventListener('click',()=>viewer.openRuleViewer?.())
 document.body.appendChild(button)
}

export function installRuleViewer(){
 ensureStyles()
 syncRuleButton()
 const observer=new MutationObserver(syncRuleButton)
 observer.observe(document.getElementById('root')??document.body,{childList:true,subtree:true})
 return()=>observer.disconnect()
}
