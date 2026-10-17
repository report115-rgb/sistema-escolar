import {failureMap} from '../assets/se7-attendance-rules.js';
import {randomBytes} from 'node:crypto';
import {validId} from './security.mjs';
import {assertStudent} from './polos.mjs';
import {receiptFile} from './payroll-receipt.mjs';
import {attendancePolo} from './attendance-polo.mjs';
import {canAttend} from '../assets/se7-ingress-policy.js';
const fail=(s,m)=>{throw Object.assign(Error(m),{status:s});};
export async function justification(db,b,u){
 if(!['master','secretaria'].includes(u.role))fail(403,'Comprovante restrito ao master e à secretaria.');
 const sr=db.collection('students').doc(validId(b.studentId)),snap=await sr.get();if(!snap.exists)fail(404,'Aluno não encontrado.');assertStudent(u,snap.data());
 if(b.action==='attendance-justification-get'){const id=snap.data().attendance?.[b.date]?.justification?.id;if(!id)fail(404,'Justificativa não encontrada.');const f=await db.collection('se7AttendanceProofs').doc(validId(id)).get();if(!f.exists||f.data().studentId!==snap.id||f.data().date!==b.date)fail(404,'Documento não encontrado.');return {name:f.data().name,mime:f.data().mime,base64:f.data().base64};}
 if(b.action!=='attendance-justification-save')fail(400,'Operação inválida.');
 const file=receiptFile(b);if(!['Atestado médico','Declaração de trabalho','Outro documento comprobatório'].includes(b.reason))fail(400,'Selecione o tipo de justificativa.');
 const poloId=await attendancePolo(db,{classId:b.classId,teacherId:b.teacherId},u);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||''))fail(400,'Selecione a aula original.');
 const calendars=await db.collection('academicCalendars').where('classId','==',b.classId).get(),rows=calendars.docs.map(d=>d.data());
 const event=rows.find(e=>e.dates?.includes(b.date)&&e.subject===b.subject&&e.eventType!=='holiday'&&e.countsForAttendance!==false&&!['exam','simulation','inaugural'].includes(e.eventType));if(!event)fail(409,'Aula não encontrada no calendário.');
 const id=randomBytes(24).toString('hex'),ref=db.collection('se7AttendanceProofs').doc(id),lock=db.collection('attendanceLocks').doc(b.classId+'_'+b.date+'_'+poloId),history=db.collection('attendanceRecords').doc();const at=new Date().toISOString();
 const meta={id,name:file.name,reason:b.reason,uploadedAt:at,uploadedBy:u.uid};
 await db.runTransaction(async tx=>{const live=await tx.get(sr),lockSnap=await tx.get(lock);const s=live.data();assertStudent(u,s);if(!s||s.classId!==b.classId||s.poloId!==poloId||!['Ativo','Ativa'].includes(s.status)||!canAttend(s,b.date,rows,b.subject))fail(409,'Aluno não elegível para esta aula.');
  const previous=s.attendance?.[b.date]||null;
  tx.set(ref,{...file,studentId:snap.id,date:b.date,poloId,classId:b.classId,subject:b.subject,reason:b.reason,uploadedBy:u.uid,uploadedAt:at,previousProofId:previous?.justification?.id||null});
  tx.update(sr,{attendanceFailures:failureMap({...s,attendance:{...(s.attendance||{}),[b.date]:{status:'Falta',justified:true,subject:b.subject}}},rows),['attendance.'+b.date]:{...(previous||{}),status:'Falta',justified:true,justification:meta,subject:b.subject,teacherId:b.teacherId,updatedAt:at}});
  tx.set(lock,{...(lockSnap.data()||{}),poloId,classId:b.classId,date:b.date,registros:{...(lockSnap.data()?.registros||{}),[snap.id]:'Falta'},updatedAt:at});
  tx.set(history,{poloId,classId:b.classId,date:b.date,teacherId:b.teacherId,actorUid:u.uid,timestamp:at,action:'falta_justificada',proofId:id,frequencias:[{studentId:snap.id,studentName:s.fullname,status:'Falta',justified:true,previousStatus:previous?.status||''}]});
 });return {ok:true,justification:meta};
}
