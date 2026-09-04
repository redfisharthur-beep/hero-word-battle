const RULE_BUTTON_ID='game-rule-button'
const RULE_MODAL_ID='game-rule-modal'
const RULE_IMAGES=['/images/jobs/rule1.png','/images/jobs/rule2.png','/images/jobs/rule3.png']

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value))

function ensureStyles(){
 if(document.getElementById('game-rule-viewer-styles'))return
 const style=document.createElement('style')
 style.id='game-rule-viewer-styles'
 style.textContent=`
/* Return + rule buttons: same size, same height, perfectly mirrored left/right. */
.rooms-page .back-button,
.lobby-page .back-button,
.jobs-page .back-button{
 position:fixed!important;
 left:3vw!important;
 right:auto!important;
 top:10px!important;
 z-index:90!important;
 width:112px!important;
 min-width:112px!important;
 max-width:112px!important;
 height:56px!important;
 min-height:56px!important;
 max-height:56px!important;
 margin:0!important;
 padding:0!important;
 border:0!important;
 border-radius:0!important;
 outline:0!important;
 background:transparent url('/images/rooms/return.png') center/contain no-repeat!important;
 box-shadow:none!important;
 color:transparent!important;
 font-size:0!important;
 line-height:0!important;
 overflow:visible!important;
 transform:none!important;
 cursor:pointer!important;
 touch-action:manipulation!important;
}
.rooms-page .back-button:hover,
.lobby-page .back-button:hover,
.jobs-page .back-button:hover{filter:brightness(1.08)!important;transform:none!important}
.rooms-page .back-button:active,
.lobby-page .back-button:active,
.jobs-page .back-button:active{transform:scale(.96)!important}

#${RULE_BUTTON_ID}{
 position:fixed;
 right:3vw;
 left:auto;
 top:10px;
 z-index:90;
 width:112px;
 min-width:112px;
 max-width:112px;
 height:56px;
 min-height:56px;
 max-height:56px;
 margin:0;
 padding:0;
 border:0;
 border-radius:0;
 outline:0;
 background:transparent url('/images/rooms/rule.png') center/contain no-repeat;
 box-shadow:none;
 font-size:0;
 color:transparent;
 cursor:pointer;
 touch-action:manipulation;
}
#${RULE_BUTTON_ID}:hover{transform:none;filter:brightness(1.08)}
#${RULE_BUTTON_ID}:active{transform:scale(.96)}

/* Rule viewer: only the three images and a close button are visible. */
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
 .rooms-page .back-button,.lobby-page .back-button,.jobs-page .back-button{left:3vw!important;top:10px!important;width:112px!important;min-width:112px!important;max-width:112px!important;height:56px!important;min-height:56px!important;max-height:56px!important}
 #${RULE_BUTTON_ID}{right:3vw;top:10px;width:112px;min-width:112px;max-width:112px;height:56px;min-height:56px;max-height:56px}
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
 const supportedPage=document.querySelector('.rooms-page,.lobby-page,.jobs-page')
 const existing=document.getElementById(RULE_BUTTON_ID)
 if(!supportedPage){existing?.remove();return}
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
