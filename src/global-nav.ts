const NAV_ID='game-global-nav'
const RETURN_ID='game-return-button'

function currentPage(){
  return document.querySelector('.rooms-page,.lobby-page,.jobs-page') as HTMLElement|null
}

function ensureGlobalNav(){
  const page=currentPage()
  let nav=document.getElementById(NAV_ID) as HTMLDivElement|null
  if(!page){
    nav?.remove()
    return
  }

  if(!nav){
    nav=document.createElement('div')
    nav.id=NAV_ID
    nav.setAttribute('aria-label','遊戲導覽')
    document.body.appendChild(nav)
  }

  let back=document.getElementById(RETURN_ID) as HTMLButtonElement|null
  if(!back){
    back=document.createElement('button')
    back.id=RETURN_ID
    back.type='button'
    back.setAttribute('aria-label','返回')
    back.title='返回'
    back.addEventListener('click',()=>{
      const source=currentPage()?.querySelector('.back-button') as HTMLButtonElement|null
      source?.click()
    })
  }
  if(back.parentElement!==nav)nav.appendChild(back)

  const rule=document.getElementById('game-rule-button')
  if(rule&&rule.parentElement!==nav)nav.appendChild(rule)
}

export function installGlobalNav(){
  ensureGlobalNav()
  const observer=new MutationObserver(ensureGlobalNav)
  observer.observe(document.body,{childList:true,subtree:true})
  return()=>observer.disconnect()
}
