// Motor isolado do EJA Modular: ciclo de 30 dias a partir do primeiro pagamento confirmado.
// Nenhuma gravação, liberação de prova, cobrança ou alteração de aluno ocorre neste módulo.
import {MODULAR_DURATIONS} from './eja-modular-plan.mjs';
const fail=m=>{throw Object.assign(Error(m),{status:400});};
function day(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))fail('Data inválida.');
 const [y,m,d]=date.split('-').map(Number),n=Date.UTC(y,m-1,d);
 if(new Date(n).toISOString().slice(0,10)!==date)fail('Data inválida.');
 return n/86400000;
}
const date=n=>new Date(n*86400000).toISOString().slice(0,10);
export function modularCyclePlan({subjects,months,firstPaymentConfirmedDate}){
 if(!MODULAR_DURATIONS.includes(months))fail('Duração modular inválida.');
 if(!Array.isArray(subjects)||!subjects.length||subjects.length>200)fail('Disciplinas inválidas.');
 const start=day(firstPaymentConfirmedDate),seen=new Set();
 return subjects.map((s,i)=>{
  const subjectId=String(s?.id||'').trim();
  if(!subjectId||seen.has(subjectId))fail('Disciplina sem identificador ou duplicada.');
  seen.add(subjectId);
  const cycle=Math.floor(i*months/subjects.length);
  return {subjectId,cycle:cycle+1,contentReleaseDate:date(start+cycle*30),examEarliestDate:date(start+cycle*30+27)};
 });
}
export function modularDisciplineState({discipline,today,materialAccessed=false,videoCompleted=false,examCompleted=false}){
 const now=day(today),content=day(discipline.contentReleaseDate),exam=day(discipline.examEarliestDate);
 if(examCompleted)return now>=content?'completed':'scheduled';
 if(now<content)return 'scheduled';
 if(now<exam)return 'studying';
 return materialAccessed&&videoCompleted?'exam_eligible':'requirements_pending';
}
