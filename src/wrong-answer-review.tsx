import { useEffect, useState } from 'react'

export type WrongAnswerItem={id:string;word:string;selectedAnswer:string;correctAnswer:string}
type DictionaryInfo={definition?:string;example?:string}

const fallbackExample=(word:string)=>`I learned the word “${word}” today.`

async function loadDictionary(word:string):Promise<DictionaryInfo>{
 try{
  const response=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
  if(!response.ok)return{}
  const data=await response.json() as Array<{meanings?:Array<{definitions?:Array<{definition?:string;example?:string}>}>}>
  const definitions=data.flatMap(entry=>entry.meanings??[]).flatMap(meaning=>meaning.definitions??[])
  const withExample=definitions.find(item=>item.example)
  const first=definitions.find(item=>item.definition)
  return{definition:first?.definition,example:withExample?.example}
 }catch{return{}}
}

export default function WrongAnswerReview({items,onClose}:{items:WrongAnswerItem[];onClose:()=>void}){
 const[details,setDetails]=useState<Record<string,DictionaryInfo>>({})
 useEffect(()=>{let active=true;void Promise.all(items.map(async item=>[item.id,await loadDictionary(item.word)] as const)).then(entries=>{if(active)setDetails(Object.fromEntries(entries))});return()=>{active=false}},[items])
 return <div className="wrong-review-overlay" role="dialog" aria-modal="true" aria-label="錯題分析">
  <section className="wrong-review-panel">
   <div className="wrong-review-header"><div><span className="wrong-review-kicker">MY WORD REVIEW</span><h2>我的錯題分析</h2><p>本場共 {items.length} 題答錯，逐題複習正確意思與例句。</p></div><button className="wrong-review-close" type="button" onClick={onClose} aria-label="關閉錯題分析">×</button></div>
   {items.length===0?<div className="wrong-review-perfect"><strong>本場沒有錯題 🎉</strong><span>全部答對，表現很棒！</span></div>:<div className="wrong-review-list">{items.map((item,index)=>{const info=details[item.id];return <article className="wrong-review-card" key={item.id}>
    <div className="wrong-review-number">{index+1}</div>
    <div className="wrong-review-word">{item.word}</div>
    <div className="wrong-review-row wrong-choice"><span>你的答案</span><b>{item.selectedAnswer}</b></div>
    <div className="wrong-review-row correct-choice"><span>正確解釋</span><b>{item.correctAnswer}</b></div>
    <div className="wrong-review-explain"><span>英文解釋</span><p>{info?.definition??'正在查詢單字解釋…'}</p></div>
    <div className="wrong-review-example"><span>例句</span><p>{info?.example??fallbackExample(item.word)}</p></div>
   </article>})}</div>}
   <button className="primary-button wrong-review-done" type="button" onClick={onClose}>看完了</button>
  </section>
 </div>
}
