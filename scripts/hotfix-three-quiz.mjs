import { readFile, writeFile } from 'node:fs/promises'

const path='worker/index.ts'
let text=await readFile(path,'utf8')
const risky="const slot=Math.max(0,Math.min(2,p.quizIndex??0)),publicQ=s.questions?.[slot];if(!publicQ)return json({error:'Question unavailable'},409);const q=getVocabularyQuestion(s.wordPoolSize,publicQ.id-1),correct=b.choice===q.answer,now=Date.now();"
const safe="const slot=Math.max(0,Math.min(2,p.quizIndex??0));let publicQ=s.questions?.[slot]??s.question;if(!publicQ){this.pickQuestion(s);publicQ=publicQuestion(this.currentQuestion(s));s.question=publicQ}const q=getVocabularyQuestion(s.wordPoolSize,Math.max(0,publicQ.id-1)),correct=b.choice===q.answer,now=Date.now();"
if(text.includes(risky)){
  text=text.replace(risky,safe)
  await writeFile(path,text,'utf8')
  console.log('Applied three-question answer-state compatibility hotfix.')
}else if(text.includes(safe)){
  console.log('Three-question compatibility hotfix already present.')
}else{
  throw new Error('worker/index.ts: three-question answer hotfix target not found')
}
