// Planejamento isolado do EJA Modular. Não grava dados, libera aulas ou cria cobranças.
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export const MODULAR_DURATIONS=Object.freeze([3,6,9]);
export function modularInstallments(totalCents,months){
 if(!MODULAR_DURATIONS.includes(months))fail('Duração modular inválida.');
 if(!Number.isSafeInteger(totalCents)||totalCents<0)fail('Valor total inválido.');
 const base=Math.floor(totalCents/months),extra=totalCents%months;
 return Array.from({length:months},(_,i)=>base+(i<extra?1:0));
}
export function modularReleaseDate(startDate,monthOffset){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!Number.isInteger(monthOffset)||monthOffset<0||monthOffset>120)fail('Data de início ou período inválido.');
 const [y,m,d]=startDate.split('-').map(Number),start=new Date(Date.UTC(y,m-1,d,12));
 if(start.getUTCFullYear()!==y||start.getUTCMonth()!==m-1||start.getUTCDate()!==d)fail('Data de início inválida.');
 const first=new Date(Date.UTC(y,m-1+monthOffset,1,12));
 const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0,12)).getUTCDate();
 return new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(d,last),12)).toISOString().slice(0,10);
}
export function planModularSubjects({subjects,months,startDate}){
 if(!MODULAR_DURATIONS.includes(months))fail('Duração modular inválida.');
 if(!Array.isArray(subjects)||!subjects.length||subjects.length>200)fail('Disciplinas inválidas.');
 modularReleaseDate(startDate,0);
 const ids=new Set();
 return subjects.map((subject,index)=>{
  const id=String(subject?.id||'').trim();
  if(!id||ids.has(id))fail('Identificador de disciplina inválido ou repetido.');
  ids.add(id);
  const monthIndex=Math.floor(index*months/subjects.length);
  return {subjectId:id,monthIndex:monthIndex+1,releaseDate:modularReleaseDate(startDate,monthIndex)};
 });
}
