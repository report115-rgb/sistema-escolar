import {randomInt} from 'node:crypto';
import {validId} from './security.mjs';
import {modularCyclePlan,modularExamWindow} from './eja-modular-cycle.mjs';
import {studentModularAccess} from './eja-modular-student.mjs';
import {prepareModularExam,gradeModularExam} from './eja-modular-exams.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function shuffleExamQuestions(source){const questions=source.map(q=>({...q,opcoes:[...q.opcoes]}));for(let i=questions.length-1;i>0;i--){const j=randomInt(i+1);[questions[i],questions[j]]=[questions[j],questions[i]];}for(const q of questions){const options=q.opcoes.map((text,i)=>({text,correct:i===q.correta}));for(let i=options.length-1;i>0;i--){const j=randomInt(i+1);[options[i],options[j]]=[options[j],options[i]];}q.opcoes=options.map(x=>x.text);q.correta=options.findIndex(x=>x.correct);}return questions;}
export const publicAttempt=a=>({status:a.status,answers:a.answers||{},submittedCount:Object.keys(a.answers||{}).length,grade:a.status==='completed'||a.status==='expired'?a.grade:null,approved:a.status==='completed'||a.status==='expired'?a.approved:null,correct:a.status==='completed'||a.status==='expired'?a.correct:null});
export async function modularStudentExamAction(db,b,u){
 if(u.role!=='aluno'||!u.studentId)fail(403,'Acesso exclusivo do aluno.');
 const sid=validId(u.studentId),subjectId=validId(b.subjectId);
 const studentDoc=await db.collection('students').doc(sid).get();
 if(!studentDoc.exists||studentDoc.data().se7AuthUid!==u.uid)fail(403,'Matrícula não autorizada.');
 const student=studentDoc.data(),courseId=validId(student.courseId);
 const courseDoc=await db.collection('courses').doc(courseId).get();
 if(!courseDoc.exists)fail(404,'Curso não encontrado.');
 const access=studentModularAccess(student,{...courseDoc.data(),id:courseId});
 if(!access.active)fail(403,'Curso ainda não ativado.');
 const discipline=modularCyclePlan({subjects:courseDoc.data().subjects,months:access.activation.months,firstPaymentConfirmedDate:access.activation.firstPaymentConfirmedDate}).find(x=>x.subjectId===subjectId);
 if(!discipline)fail(404,'Disciplina não encontrada.');
 const examDoc=await db.collection('se7EjaModularExams').doc(courseId+'_'+subjectId).get();
 if(!examDoc.exists||examDoc.data().published!==true)fail(409,'Avaliação não publicada.');
 const prepared=prepareModularExam(examDoc.data());
 const ref=db.collection('se7EjaModularAttempts').doc(sid+'_'+courseId+'_'+subjectId);
 const operation=b.operation||'read';
 if(!['read','submit','finish'].includes(operation))fail(400,'Operação inválida.');
 let result;
 await db.runTransaction(async tx=>{
  const [old,freshStudent]=await Promise.all([tx.get(ref),tx.get(studentDoc.ref||db.collection('students').doc(sid))]);
  if(!freshStudent.exists||freshStudent.data().se7AuthUid!==u.uid||freshStudent.data().courseId!==courseId)fail(403,'Matrícula alterada durante a avaliação.');
  const current=old.exists?old.data():null;
  const window=modularExamWindow(discipline,new Date());
  if(!current&&!window.open)return result={window,status:window.expired?'expired':'scheduled',questions:[],answers:{},submittedCount:0};
  const questions=current?.questions||shuffleExamQuestions(prepared.questions);
  const answers=current?.answers||{};
  if(current&&(current.studentId!==sid||current.courseId!==courseId||current.subjectId!==subjectId))fail(409,'Tentativa inconsistente.');
  if(current?.status==='completed'||current?.status==='expired')return result={window,...publicAttempt(current),questions:[]};
  if(!window.open){
   const grade=gradeModularExam(questions,answers);
   const closed={...current,status:'expired',...grade,closedAt:new Date().toISOString()};
   tx.set(ref,closed);
   const previous=freshStudent.data().grades?.[subjectId];
   if(!previous||previous.source==='eja-modular')tx.set(db.collection('students').doc(sid),{grades:{...freshStudent.data().grades,[subjectId]:{final:closed.grade,status:closed.approved?'Aprovado':'Reprovado',source:'eja-modular',attemptId:ref.id,recordedAt:closed.closedAt}}},{merge:true});
   return result={window,...publicAttempt(closed),questions:[]};
  }
  const attempt=current||{studentId:sid,courseId,subjectId,questions,answers:{},status:'in_progress',startedAt:new Date().toISOString()};
  const expireIfLate=()=>{
   const latest=modularExamWindow(discipline,new Date());
   if(latest.open)return false;
   const grade=gradeModularExam(questions,attempt.answers);
   const expired={...attempt,...grade,status:'expired',closedAt:new Date().toISOString()};
   tx.set(ref,expired);
   const previous=freshStudent.data().grades?.[subjectId];
   if(!previous||previous.source==='eja-modular')tx.set(db.collection('students').doc(sid),{grades:{...freshStudent.data().grades,[subjectId]:{final:expired.grade,status:expired.approved?'Aprovado':'Reprovado',source:'eja-modular',attemptId:ref.id,recordedAt:expired.closedAt}}},{merge:true});
   result={window:latest,...publicAttempt(expired),questions:[]};
   return true;
  };
  if(operation==='submit'){
   if(!Number.isInteger(b.index)||b.index<0||b.index>=10||!Number.isInteger(b.answer)||b.answer<0||b.answer>4)fail(400,'Resposta inválida.');
   if(Object.prototype.hasOwnProperty.call(answers,String(b.index)))fail(409,'Questão já enviada. Não é permitido alterar a resposta registrada.');
   // A janela é conferida novamente imediatamente antes da gravação.
   if(expireIfLate())return;
   attempt.answers={...answers,[String(b.index)]:b.answer};
   attempt.updatedAt=new Date().toISOString();
  }
  if(operation==='finish'){
   if(expireIfLate())return;
   if(Object.keys(attempt.answers).length!==10)fail(409,'Envie as dez respostas antes de finalizar.');
   const grade=gradeModularExam(questions,attempt.answers);
   Object.assign(attempt,grade,{status:'completed',closedAt:new Date().toISOString()});
  }
  if(attempt.status==='completed'){
   const previous=freshStudent.data().grades?.[subjectId];
   if(!previous||previous.source==='eja-modular')tx.set(db.collection('students').doc(sid),{grades:{...freshStudent.data().grades,[subjectId]:{final:attempt.grade,status:attempt.approved?'Aprovado':'Reprovado',source:'eja-modular',attemptId:ref.id,recordedAt:attempt.closedAt}}},{merge:true});
  }
  if(!current||operation!=='read')tx.set(ref,attempt);
  result={window,...publicAttempt(attempt),questions:attempt.status==='in_progress'?questions.map(({correta,...q})=>q):[]};
 });
 return result;
}
