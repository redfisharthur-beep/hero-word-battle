import { readFile, writeFile } from 'node:fs/promises'

async function update(path, transform){
  const source=await readFile(path,'utf8')
  const next=transform(source)
  if(next===source) throw new Error(`${path}: quiz UX patch made no changes`)
  await writeFile(path,next,'utf8')
}

await update('src/lib/multiplayer.ts', source=>{
  let text=source
  if(!text.includes('export type AnswerResponse =')){
    text=text.replace(
      "export type RemoteQuestion = { id:number; word:string; choices:string[] }",
      "export type RemoteQuestion = { id:number; word:string; choices:string[] }\nexport type AnswerResponse = RemoteRoomState & { answerFeedback?:{ correct:boolean; correctAnswer:string; questionNumber:number } }"
    )
  }
  text=text.replace(
    "answer:(roomId:string,playerId:string,choice:string,coefficient:number)=>apiRequest<RemoteRoomState>(`/api/rooms/${encodeURIComponent(roomId)}/answer`,{playerId,choice,coefficient})",
    "answer:(roomId:string,playerId:string,choice:string,coefficient:number)=>apiRequest<AnswerResponse>(`/api/rooms/${encodeURIComponent(roomId)}/answer`,{playerId,choice,coefficient})"
  )
  return text
})

await update('src/App.tsx', source=>{
  let text=source

  text=text.replace(";const quizQuestionNumber=Math.min(3,(me?.quizIndex??0)+1);",';')

  if(!text.includes('wrongFeedback,setWrongFeedback')){
    text=text.replace(
      "const[selectedChoice,setSelectedChoice]=useState('');",
      "const[selectedChoice,setSelectedChoice]=useState('');const[wrongFeedback,setWrongFeedback]=useState<{question:typeof fallbackQuestion;correctAnswer:string}|null>(null);"
    )
  }

  text=text.replace(
    /const question=roomState\?\.questions\?\.\[Math\.min\(2,me\?\.quizIndex\?\?0\)\]\?\?roomState\?\.question\?\?fallbackQuestion;/,
    "const liveQuestion=roomState?.questions?.[Math.min(2,me?.quizIndex??0)]??roomState?.question??fallbackQuestion;const question=wrongFeedback?.question??liveQuestion;"
  )

  text=text.replace(
    '<div className="word-line"><span className="quiz-progress">第 {quizQuestionNumber} / 3 題</span><strong className="word">{question.word}</strong></div>',
    '<div className="word-line"><strong className="word">{question.word}</strong></div>'
  )

  text=text.replace(
    '<div className="quiz-card"><div className="word-line">',
    '<div className={`quiz-card ${me?.answered?\'quiz-complete\':\'\'}`}><div className="word-line">'
  )

  text=text.replace(
    'className={`answer-choice answer-choice-${i+1} ${selectedChoice===c?\'chosen\':\'\'} ${selectedChoice&&selectedChoice!==c?\'dimmed\':\'\'}`}',
    'className={`answer-choice answer-choice-${i+1} ${selectedChoice===c?\'chosen\':\'\'} ${wrongFeedback?.correctAnswer===c?\'correct-answer\':\'\'} ${(wrongFeedback&&wrongFeedback.correctAnswer!==c)||(selectedChoice&&selectedChoice!==c)?\'dimmed\':\'\'}`}'
  )
  text=text.replace(
    'disabled={Boolean(me.answered)||remainingSeconds<=0} onClick={()=>void submitAnswer(c)}',
    'disabled={Boolean(me.answered)||Boolean(wrongFeedback)||remainingSeconds<=0} onClick={()=>void submitAnswer(c)}'
  )

  const submitStart=text.indexOf(' const submitAnswer=async(choice:string)=>{')
  const leaveStart=text.indexOf(' const leaveRoom=async()=>{',submitStart)
  if(submitStart<0||leaveStart<0) throw new Error('src/App.tsx: submitAnswer block not found')
  const replacement=` const submitAnswer=async(choice:string)=>{if(!roomState||me?.answered||wrongFeedback)return;const answeredQuestion=question;setSelectedChoice(choice);if(!online){setRoomState({...roomState,players:roomState.players.map(p=>p.id===playerId?{...p,answered:true,answerCorrect:choice==='勇敢的',coefficient:choice==='勇敢的'?1:0,answeredAt:Date.now()}:p)});return}setError('');try{const next=await multiplayerApi.answer(roomId,playerId,choice,0),feedback=next.answerFeedback;if(feedback&&!feedback.correct){try{const audio=new Audio('/music/wrong.mp3');audio.volume=.95;void audio.play().catch(()=>undefined)}catch{}setWrongFeedback({question:answeredQuestion,correctAnswer:feedback.correctAnswer});window.setTimeout(()=>{setWrongFeedback(null);setSelectedChoice('');void syncBattleSilently()},650);return}setWrongFeedback(null);setSelectedChoice('');setRoomState(next)}catch(e){const message=e instanceof Error?e.message:'答案送出失敗';if(isPhaseTransitionError(message)){await syncBattleSilently();return}setError(message)}}\n`
  text=text.slice(0,submitStart)+replacement+text.slice(leaveStart)

  return text
})

console.log('Quiz UX polished: wrong answer highlights correct choice, no progress label, BGM waits for quiz completion.')
