const ultimateArt:Record<string,{id:string;src:string}>={
 '刺客':{id:'assassin',src:'/images/actions/Shadow Kill.png'},
 '戰士':{id:'warrior',src:'/images/actions/Unyielding War Soul.png'},
 '弓箭手':{id:'archer',src:'/images/actions/Cloud-Piercing Snipe.png'},
 '武道家':{id:'fighter',src:'/images/actions/Diamond Body.png'},
 '牧師':{id:'priest',src:'/images/actions/Holy Miracle.png'},
 '法師':{id:'mage',src:'/images/actions/Doomsday Magic.png'},
}

function decorateUltimateResult(capsule:HTMLElement){
 if(capsule.dataset.comfortUltimate==='1')return
 const jobName=capsule.querySelector('.result-actor-copy small')?.textContent?.trim()??''
 const art=ultimateArt[jobName]
 if(!art)return
 capsule.dataset.comfortUltimate='1'
 capsule.dataset.ultimateJob=art.id
 capsule.querySelector('.ultimate-burst')?.remove()
 capsule.querySelector('.result-action-mark b')?.remove()

 const overlay=document.createElement('div')
 overlay.className='ultimate-cinematic'
 const img=document.createElement('img')
 img.src=art.src
 img.alt=''
 overlay.appendChild(img)
 document.body.appendChild(overlay)
 window.setTimeout(()=>overlay.remove(),1150)
}

function syncUltimateResults(){
 document.querySelectorAll<HTMLElement>('.result-capsule.result-ultimate').forEach(decorateUltimateResult)
}

export function installComfortUi(){
 syncUltimateResults()
 const observer=new MutationObserver(syncUltimateResults)
 observer.observe(document.getElementById('root')??document.body,{childList:true,subtree:true})
 return()=>observer.disconnect()
}
