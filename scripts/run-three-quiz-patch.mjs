import { readFile, writeFile } from 'node:fs/promises'

const path='scripts/patch-three-quiz.mjs'
let source=await readFile(path,'utf8')
const old=`  for(const [label,from,to] of patches){\n    if(text.includes(to)) continue\n    if(!text.includes(from)) throw new Error(\`${'${'}path}: patch target not found: ${'${'}label}\`)\n    text=text.replace(from,to)\n  }`
const next=`  for(const [label,from,to] of patches){\n    if(text.includes(from)){text=text.replace(from,to);continue}\n    if(text.includes(to)) continue\n    throw new Error(\`${'${'}path}: patch target not found: ${'${'}label}\`)\n  }`
if(source.includes(old)){
  source=source.replace(old,next)
  await writeFile(path,source,'utf8')
}
await import('./patch-three-quiz.mjs')
await import('./patch-quiz-ux.mjs')
