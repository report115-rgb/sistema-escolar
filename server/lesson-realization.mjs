import {validId} from './security.mjs';
import {assertStudent} from './polos.mjs';
const fail=(s,m)=>{throw Object.assign(Error(m),{status:s});};
export const reasons=['A pedido do professor','A pedido da turma','Indisponibilidade do espaço','Ajuste da programação','Outro motivo'];
const date=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
export async function save(db,b,u){
 if(!['master','secretaria'].includes(u.role))fail(403,'Alteração restrita ao master e à secretaria.');
 if(!date(b.originalDate)||!date(b.actualDate)||!reasons.includes(b.reason))fail(400,'Informe datas válidas e o motivo.');
 const detail=String(b.detail||'').trim();if(detail.length>300||b.reason==='Outro motivo'&&!detail)fail(400,'Informe um motivo de até 300 caracteres.');
 const ref=db.collection('academicCalendars').doc(validId(b.eventId));
 return db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)fail(404,'Aula não encontrada.');const e=snap.data();if(e.eventType&&e.eventType!=='lesson'||e.countsForAttendance===false||!e.dates?.includes(b.originalDate))fail(409,'Selecione uma aula do calendário.');
  if(!e.poloId)fail(409,'Confira o polo do calendário.');assertStudent(u,e);
  const polo=await tx.get(db.collection('polos').doc(e.poloId));if(!polo.exists||polo.data().active===false)fail(403,'Polo indisponível.');
  if(u.role==='secretaria'){const staff=await tx.get(db.collection('se7Staff').doc(u.uid));if(!staff.exists||staff.data().disabled||staff.data().perfil!=='secretaria'||staff.data().poloId!==e.poloId)fail(403,'Seu vínculo de polo foi alterado. Entre novamente.');}
  const value={actualDate:b.actualDate,reason:b.reason,detail:b.reason==='Outro motivo'?detail:'',updatedAt:new Date().toISOString(),updatedBy:u.uid};
  const realizations={...(e.realizations||{}),[b.originalDate]:value};
  const log=db.collection('se7LessonRealizationHistory').doc();tx.set(log,{eventId:snap.id,poloId:e.poloId,classId:e.classId,originalDate:b.originalDate,previous:e.realizations?.[b.originalDate]||null,...value});tx.update(ref,{realizations});return {eventId:snap.id,originalDate:b.originalDate,value};
 });
}
