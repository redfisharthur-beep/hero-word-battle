const RULE_BUTTON_ID='game-rule-button'
const RULE_MODAL_ID='game-rule-modal'
const RULE_IMAGES=['/images/jobs/rule1.png','/images/jobs/rule2.png','/images/jobs/rule3.png']

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))

function ensureStyles(){
 if(document.getElementById('game-rule-viewer-styles'))return
 const style=document.createElement('style')
 style.id='game-rule-viewer-styles'
 style.textContent=`
/* Rule viewer only. Navigation button layout is owned by comfort-ui.css. */
#${RULE_MODAL_ID}{position:fixed;inset:0;z-index:9999;display:block;background:#050914;overscroll-behavior:contain}
#${RULE_MODAL_ID}[hidden]{display:none!important}
#${RULE_MODAL_ID} .rule-close{
 position:fixed;
 top:max(10px,env(safe-area-inset-top));
 right:max(10px,env(safe-area-inset-right));
 z-index:10;
 width:48px;
 height:48px;
 min-width:48px;
 min-height:48px;
 margin:0;
 padding:0;
 border:0;
 border-radius:50%;
 background:rgba(0,0,0,.62);
 color:#fff;
 font:400 32px/1 Arial,sans-serif;
 display:grid;
 place-items:center;
 box-shadow:0 2px 10px rgba(0,0,0,.34);
 cursor:pointer;
 touch-action:manipulation;
}
#${RULE_MODAL_ID} .rule-scroll{
 position:absolute;
 inset:0;
 overflow:auto;
 -webkit-overflow-scrolling:touch;
 touch-action:pan-x pan-y;
 overscroll-behavior:contain;
 background:#050914;
}
#${RULE_MODAL_ID} .rule-stage{
 width:100%;
 min-width:100%;
 min-height:100%;
 padding:0 0 28px;
 margin:0;
 display:flex;
 flex-direction:column;
 align-items:flex-start;
 gap:0;
}
#${RULE_MODAL_ID} .rule-image{
 display:block;
 width:100%;
 height:auto;
 max-width:none;
 margin:0;
 padding:0;
 border:0;
 box-shadow:none;
 user-select:none;
 -webkit-user-drag:none;
 transform-origin:top left;
}
@media(max-width:760px){
 #${RULE_MODAL_ID} .rule-close{width:46px;height:46px;min-width:46px;min-height:46px;font-size:30px}
}
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
 modal.innerHTML=`<button class="rule-close" type="button" aria-label="關閉遊戲說明">×</button><div class="rule-scroll"><div class="rule-stage"></div></div>`
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
 let zoom=1
 let pinchStartDistance=0
 let pinchStartZoom=1
 const applyZoom=()=>{
  const width=`${Math.round(zoom*100)}%`
  for(const img of Array.from(modal!.querySelectorAll<HTMLImageElement>('.rule-image')))img.style.width=width
 }
 const setZoom=(next:number)=>{zoom=clamp(next,.5,3);applyZoom()}
 const close=()=>{modal!.hidden=true;document.body.style.overflow='';setZoom(1);scroll.scrollTo({top:0,left:0})}
 const open=()=>{modal!.hidden=false;document.body.style.overflow='hidden';setZoom(1);scroll.scrollTo({top:0,left:0});(modal!.querySelector('.rule-close') as HTMLButtonElement).focus()}
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
 const supportedPage=document.querySelector('.rooms-page,.lobby-page,.jobs-page') as HTMLElement|null
 const existing=document.getElementById(RULE_BUTTON_ID) as HTMLButtonElement|null
 if(!supportedPage){existing?.remove();return}
 const pageType=supportedPage.classList.contains('lobby-page')?'lobby':supportedPage.classList.contains('jobs-page')?'jobs':'rooms'
 const targetCard=supportedPage.querySelector('.rooms-card,.lobby-card,.jobs-card') as HTMLElement|null
 if(!targetCard)return
 if(existing){
  existing.dataset.page=pageType
  if(existing.parentElement!==targetCard)targetCard.appendChild(existing)
  return
 }
 const viewer=createViewer() as HTMLDivElement & {openRuleViewer?:()=>void}
 const button=document.createElement('button')
 button.id=RULE_BUTTON_ID
 button.type='button'
 button.dataset.page=pageType
 button.setAttribute('aria-label','遊戲說明')
 button.title='遊戲說明'
 button.addEventListener('click',()=>viewer.openRuleViewer?.())
 targetCard.appendChild(button)
}

export function installRuleViewer(){
 ensureStyles()
 syncRuleButton()
 const observer=new MutationObserver(syncRuleButton)
 observer.observe(document.getElementById('root')??document.body,{childList:true,subtree:true})
 return()=>observer.disconnect()
}
