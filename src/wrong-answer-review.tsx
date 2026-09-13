export type WrongAnswerItem={id:string;word:string;selectedAnswer:string;correctAnswer:string}

export default function WrongAnswerReview({items,onClose}:{items:WrongAnswerItem[];onClose:()=>void}){
 return <div className="wrong-review-overlay" role="dialog" aria-modal="true" aria-label="錯題分析">
  <section className="wrong-review-panel">
   <div className="wrong-review-header"><div><span className="wrong-review-kicker">MY WORD REVIEW</span><h2>我的錯題分析</h2></div><button className="wrong-review-close" type="button" onClick={onClose} aria-label="關閉錯題分析">×</button></div>
   {items.length===0?<div className="wrong-review-perfect"><strong>本場沒有錯題 🎉</strong><span>全部答對，表現很棒！</span></div>:<div className="wrong-review-list">{items.map((item,index)=><article className="wrong-review-card" key={item.id}>
    <div className="wrong-review-number">{index+1}</div>
    <div className="wrong-review-word">{item.word}</div>
    <div className="wrong-review-row wrong-choice"><span>你的答案</span><b>{item.selectedAnswer}</b></div>
    <div className="wrong-review-row correct-choice"><span>正確解釋</span><b>{item.correctAnswer}</b></div>
   </article>)}</div>}
   <button className="primary-button wrong-review-done" type="button" onClick={onClose}>看完了</button>
  </section>
 </div>
}
