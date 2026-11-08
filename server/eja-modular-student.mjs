import {validId} from './security.mjs';
import {modularCyclePlan,modularExamWindow} from './eja-modular-cycle.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export function studentModularAccess(student,course){
 if(course?.nivel!=='Supletivo'||course?.ejaMode!=='modular'||course?.ejaStage!=='medio')fail(409,'Curso não é EJA Modular do Ensino Médio.');
 if(!student||student.courseId!==course.id)fail(403,'Matrícula não vinculada ao curso.');
 // A data só é confiável após conciliação financeira de origem autenticada.
 const activation=student.ejaModularActivation;
 if(!activation||activation.source!=='asaas-webhook-confirmed'||!activation.paymentId||!iso(activation.firstPaymentConfirmedDate)||activation.confirmed!==true)
  return {active:false,reason:'Aguardando confirmação financeira autenticada e ativação acadêmica.'};
 if(![3,6,9].includes(activation.months))return {active:false,reason:'Duração modular ainda não validada.'};
 return {active:true,activation};
}
export async function modularStudentSnapshotAction(db,b,u){
 if(u.role!=='aluno'||!u.studentId)fail(403,'Acesso exclusivo do aluno autenticado.');
 const studentDoc=await db.collection('students').doc(validId(u.studentId)).get();
 if(!studentDoc.exists||studentDoc.data().se7AuthUid!==u.uid)fail(403,'Matrícula não autorizada.');
 const student=studentDoc.data(),courseId=validId(student.courseId);
 if(b.courseId&&validId(b.courseId)!==courseId)fail(403,'Curso não autorizado.');
 const courseDoc=await db.collection('courses').doc(courseId).get();
 if(!courseDoc.exists)fail(404,'Curso não encontrado.');
 const course={...courseDoc.data(),id:courseId},access=studentModularAccess(student,course);
 if(!access.active)return {active:false,reason:access.reason,subjects:[],progress:0};
 const plan=modularCyclePlan({subjects:course.subjects,months:access.activation.months,firstPaymentConfirmedDate:access.activation.firstPaymentConfirmedDate});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const attemptDocs=await Promise.all(plan.map(p=>db.collection('se7EjaModularAttempts').doc(validId(u.studentId)+'_'+courseId+'_'+p.subjectId).get()));
 const subjects=plan.map((p,i)=>{
  const window=modularExamWindow(p),a=attemptDocs[i].exists?attemptDocs[i].data():null;
  const trusted=a&&a.studentId===u.studentId&&a.courseId===courseId&&a.subjectId===p.subjectId?a:null;
  const ended=trusted?.status==='completed'||trusted?.status==='expired';
  const status=ended?(trusted.approved?'approved':trusted.status==='expired'?'exam_expired':'not_approved'):trusted?.status==='in_progress'?(window.expired?'exam_expired':'in_progress'):today<p.contentReleaseDate?'scheduled':window.expired?'exam_expired':window.notYetOpen?'studying':'available';
  return {subjectId:p.subjectId,cycle:p.cycle,releaseDate:p.contentReleaseDate,lessons:p.lessons.map(l=>({...l,scheduled:today>=l.releaseDate})),examEarliestDate:p.examEarliestDate,examOpenAt:p.examOpenAt,examCloseAt:p.examCloseAt,examTimeZone:p.examTimeZone,examWindow:window,available:today>=p.contentReleaseDate,examDateReached:window.open,status,submittedCount:Object.keys(trusted?.answers||{}).length,grade:ended?trusted.grade:null,approved:ended?trusted.approved:null,examCompleted:ended};
 });
 const completed=subjects.filter(s=>s.examCompleted).length,approved=subjects.filter(s=>s.approved===true).length;
 return {active:true,months:access.activation.months,firstPaymentConfirmedDate:access.activation.firstPaymentConfirmedDate,subjects,progress:Math.round(completed/subjects.length*100),progressVerified:true,completed,approved,total:subjects.length,activitiesEnabled:true};
}

export async function modularStudentMaterialsAction(db,b,u){
 if(u.role!=='aluno'||!u.studentId)fail(403,'Acesso exclusivo do aluno autenticado.');
 const studentId=validId(u.studentId),subjectId=validId(b.subjectId);
 const studentDoc=await db.collection('students').doc(studentId).get();
 if(!studentDoc.exists||studentDoc.data().se7AuthUid!==u.uid)fail(403,'Matrícula não autorizada.');
 const student=studentDoc.data(),courseId=validId(student.courseId);
 const courseDoc=await db.collection('courses').doc(courseId).get();
 if(!courseDoc.exists)fail(404,'Curso não encontrado.');
 const course={...courseDoc.data(),id:courseId},access=studentModularAccess(student,course);
 if(!access.active)fail(403,'Aguardando confirmação financeira.');
 const plan=modularCyclePlan({subjects:course.subjects,months:access.activation.months,firstPaymentConfirmedDate:access.activation.firstPaymentConfirmedDate});
 const subject=plan.find(p=>p.subjectId===subjectId);
 if(!subject)fail(404,'Disciplina não pertence ao curso.');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(today<subject.contentReleaseDate)fail(403,'Disciplina ainda não liberada.');
 const doc=await db.collection('se7EjaModularMaterials').doc(courseId+'_'+subjectId).get();
 if(!doc.exists||doc.data().complete!==true)fail(409,'Materiais ainda não publicados.');
 const materials=doc.data();
 return {subjectId,apostilaUrl:materials.apostilaUrl,ementa:materials.ementa,lessons:subject.lessons.map((l,i)=>({number:l.number,title:materials.lessons?.[i]?.title||'',url:today>=l.releaseDate?materials.lessons?.[i]?.url||'':null,releaseDate:l.releaseDate,available:today>=l.releaseDate}))};
}
