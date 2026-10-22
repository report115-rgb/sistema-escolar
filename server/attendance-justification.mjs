import {failureMap} from '../assets/se7-attendance-rules.js';
import {randomBytes} from 'node:crypto';
import {validId} from './security.mjs';
import {assertStudent} from './polos.mjs';
import {receiptFile} from './payroll-receipt.mjs';
import {attendancePolo} from './attendance-polo.mjs';
import {canAttend} from '../assets/se7-ingress-policy.js';
const fail=(s,m)=>{throw Object.assign(Error(m),{status:s});};
export async function justification(db,b,u){
 if(b.action==='attendance-justification-list'){if(u.role!=='master')fail(403,'Análise reservada à Coordenação Acadêmica.');const list=await db.collection('se7AttendancePending').where('state','==','pending').limit(101).get();return {pending:list.docs.slice(0,100).map(d=>({id:d.id,studentId:d.data().studentId,studentName:d.data().studentName,date:d.data().date,subject:d.data().subject,reason:d.data().reason,uploadedAt:d.data().uploadedAt})),more:list.docs.length>100};}
 if(b.action==='attendance-justification-decide')return decide(db,b,u);
 if(!['master','secretaria'].includes(u.role))fail(403,'Comprovante restrito ao master e à secretaria.');
 const sr=db.collection('students').doc(validId(b.studentId)),snap=await sr.get();if(!snap.exists)fail(404,'Aluno não encontrado.');assertStudent(u,snap.data());
 if(b.action==='attendance-justification-get'){const id=snap.data().attendance?.[b.date]?.justification?.id;if(!id)fail(404,'Justificativa não encontrada.');const f=await db.collection('se7AttendanceProofs').doc(validId(id)).get();if(!f.exists||f.data().studentId!==snap.id||f.data().date!==b.date)fail(404,'Documento não encontrado.');return {name:f.data().name,mime:f.data().mime,base64:f.data().base64,decisionNote:f.data().decisionNote||snap.data().attendance?.[b.date]?.justification?.decisionNote||'',state:f.data().state||snap.data().attendance?.[b.date]?.justification?.state||''};}
 if(b.action!=='attendance-justification-save')fail(400,'Operação inválida.');
 const file=receiptFile(b);if(!['Atestado médico','Declaração de trabalho','Outro documento comprobatório'].includes(b.reason))fail(400,'Selecione o tipo de justificativa.');
 const poloId=await attendancePolo(db,{classId:b.classId,teacherId:b.teacherId},u);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||''))fail(400,'Selecione a aula original.');
 const calendars=await db.collection('academicCalendars').where('classId','==',b.classId).get(),rows=calendars.docs.map(d=>d.data());
 const event=rows.find(e=>e.dates?.includes(b.date)&&e.subject===b.subject&&e.eventType!=='holiday'&&e.countsForAttendance!==false&&!['exam','simulation','inaugural'].includes(e.eventType));if(!event)fail(409,'Aula não encontrada no calendário.');
 const id=randomBytes(24).toString('hex'),ref=db.collection('se7AttendanceProofs').doc(id),lock=db.collection('attendanceLocks').doc(b.classId+'_'+b.date+'_'+poloId),history=db.collection('attendanceRecords').doc();const at=new Date().toISOString();
 const meta={id,name:file.name,reason:b.reason,state:'pending',uploadedAt:at,uploadedBy:u.uid};
 await db.runTransaction(async tx=>{const live=await tx.get(sr),lockSnap=await tx.get(lock);const s=live.data();assertStudent(u,s);if(!s||s.classId!==b.classId||s.poloId!==poloId||!['Ativo','Ativa'].includes(s.status)||!canAttend(s,b.date,rows,b.subject))fail(409,'Aluno não elegível para esta aula.');
  const previous=s.attendance?.[b.date]||null;if(previous?.justification?.state==='pending')fail(409,'Já existe justificativa aguardando análise.');
  tx.set(db.collection('se7AttendancePending').doc(id),{state:'pending',studentName:s.fullname||'Aluno',studentId:snap.id,poloId,classId:b.classId,date:b.date,subject:b.subject,reason:b.reason,uploadedAt:at});
  tx.set(ref,{...file,state:'pending',studentName:s.fullname||'Aluno',studentId:snap.id,date:b.date,poloId,classId:b.classId,subject:b.subject,reason:b.reason,uploadedBy:u.uid,uploadedAt:at,previousProofId:previous?.justification?.id||null});
  tx.update(sr,{attendanceFailures:failureMap({...s,attendance:{...(s.attendance||{}),[b.date]:{status:'Pendente de justificativa',justified:false,subject:b.subject}}},rows),['attendance.'+b.date]:{...(previous||{}),status:'Pendente de justificativa',justified:false,justification:meta,subject:b.subject,teacherId:b.teacherId,updatedAt:at}});
  tx.set(lock,{...(lockSnap.data()||{}),poloId,classId:b.classId,date:b.date,registros:{...(lockSnap.data()?.registros||{}),[snap.id]:'Pendente de justificativa'},updatedAt:at});
  tx.set(history,{poloId,classId:b.classId,date:b.date,teacherId:b.teacherId,actorUid:u.uid,timestamp:at,action:'justificativa_pendente',proofId:id,frequencias:[{studentId:snap.id,studentName:s.fullname,status:'Pendente de justificativa',justified:false,previousStatus:previous?.status||''}]});
 });return {ok:true,justification:meta};
}

async function decide(db,b,u){
 if(u.role!=='master')fail(403,'Análise reservada à Coordenação Acadêmica.');if(!['present','absent'].includes(b.decision)||typeof b.note!=='string'||!b.note.trim()||b.note.length>300)fail(400,'Escolha a decisão e informe a observação de até 300 caracteres.');
 const pr=db.collection('se7AttendanceProofs').doc(validId(b.proofId)),initial=await pr.get();if(!initial.exists)fail(404,'Justificativa não encontrada.');const p=initial.data(),sr=db.collection('students').doc(p.studentId),lr=db.collection('attendanceLocks').doc(p.classId+'_'+p.date+'_'+p.poloId),cal=await db.collection('academicCalendars').where('classId','==',p.classId).get();
 return db.runTransaction(async tx=>{const [proof,student,lock]=await Promise.all([tx.get(pr),tx.get(sr),tx.get(lr)]);if(proof.data()?.state!=='pending')fail(409,'Justificativa já analisada. Atualize a lista.');const s=student.data();if(!student.exists||s.attendance?.[p.date]?.justification?.id!==pr.id)fail(409,'Registro de frequência alterado. Confira o aluno.');const now=new Date().toISOString(),status=b.decision==='present'?'Presente':'Falta',meta={...s.attendance[p.date].justification,state:b.decision==='present'?'approved':'rejected',decisionAt:now,decisionBy:u.uid,decisionNote:b.note.trim()},record={...s.attendance[p.date],status,justified:false,justification:meta,updatedAt:now};
 tx.update(sr,{['attendance.'+p.date]:record,attendanceFailures:failureMap({...s,attendance:{...(s.attendance||{}),[p.date]:record}},cal.docs.map(d=>d.data()))});tx.update(pr,{state:meta.state,decisionBy:u.uid,decisionAt:now,decisionNote:meta.decisionNote});tx.set(db.collection('se7AttendancePending').doc(pr.id),{state:meta.state,decisionAt:now},{merge:true});tx.set(lr,{...(lock.data()||{}),classId:p.classId,poloId:p.poloId,date:p.date,registros:{...(lock.data()?.registros||{}),[p.studentId]:status},updatedAt:now});tx.set(db.collection('attendanceRecords').doc(),{poloId:p.poloId,classId:p.classId,date:p.date,actorUid:u.uid,timestamp:now,proofId:pr.id,action:'analise_coordenacao',decision:b.decision,note:meta.decisionNote,frequencias:[{studentId:p.studentId,status}]});return {ok:true,status};
 });
}
