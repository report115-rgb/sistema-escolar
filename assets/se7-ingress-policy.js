export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function planEntry({courseId,classId,enrollmentDate,calendars=[]}){
 const base={version:2,enrollmentDate,courseId:courseId||'',classId:classId||'',startDate:'',startSubject:'',notTaken:[],planned:[]};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(enrollmentDate||''))return {...base,state:'unknown_date'};
 if(!courseId||!classId)return {...base,state:'awaiting_class'};
 const events=calendars.filter(c=>c.classId===classId&&(!c.courseId||c.courseId===courseId));
 const holidays=new Set(events.filter(c=>c.eventType==='holiday').flatMap(c=>c.dates||[]));
 const groups=new Map();for(const c of events){if(c.countsForAttendance===false||['holiday','exam','simulation'].includes(c.eventType)||/^(feriado|simulado|prova)\b/.test(normalize(c.subject)))continue;const dates=(c.dates||[]).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!holidays.has(d));if(!dates.length)continue;const key=(c.semestre||'')+'|'+normalize(c.subject);if(!groups.has(key))groups.set(key,{subject:c.subject||'Disciplina',semester:c.semestre||'',dates:[]});groups.get(key).dates.push(...dates);}
 const blocks=[...groups.values()].map(g=>{const dates=[...new Set(g.dates)].sort();return {subject:g.subject,semester:g.semester,firstDate:dates[0],lastDate:dates.at(-1),dates};}).sort((a,b)=>a.firstDate.localeCompare(b.firstDate)||a.subject.localeCompare(b.subject,'pt-BR'));
 const eligible=g=>g.dates.filter(d=>d<enrollmentDate).length<2&&g.dates.some(d=>d>=enrollmentDate);
 const planned=blocks.filter(eligible).map(g=>({...g,entryDate:g.dates.find(d=>d>=enrollmentDate),missedDates:g.dates.filter(d=>d<enrollmentDate)})).sort((a,b)=>a.entryDate.localeCompare(b.entryDate)||a.subject.localeCompare(b.subject,'pt-BR'));
 const previous=blocks.filter(g=>!eligible(g)).map(g=>({...g,reason:g.lastDate>=enrollmentDate?'Duas ou mais aulas já ocorreram antes da matrícula':'Anterior ao ingresso'}));
 if(!blocks.length)return {...base,state:'awaiting_calendar'};
 if(!planned.length)return {...base,state:'awaiting_next_discipline',notTaken:previous};
 return {...base,state:'scheduled',startDate:planned[0].entryDate,startSubject:planned.filter(g=>g.entryDate===planned[0].entryDate).map(g=>g.subject).join(' / '),planned,notTaken:previous};
}
export function canAttend(student,date,calendars){
 if(!student.enrollmentDate||student.attendance?.[date])return true;
 const p=calendars?planEntry({courseId:student.courseId,classId:student.classId,enrollmentDate:student.enrollmentDate,calendars}):student.academicEntry;
 return !!p?.startDate&&date>=p.startDate;
}
if(typeof window!=='undefined')window.SE7AcademicPolicy={today,planEntry,canAttend};
