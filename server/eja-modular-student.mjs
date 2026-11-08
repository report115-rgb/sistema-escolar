import {validId} from './security.mjs';
import {modularCyclePlan} from './eja-modular-cycle.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
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
 const today=new Date().toISOString().slice(0,10);
 const subjects=plan.map(p=>({subjectId:p.subjectId,releaseDate:p.contentReleaseDate,lessons:p.lessons,examEarliestDate:p.examEarliestDate,available:today>=p.contentReleaseDate}));
 // Não retornar materiais, gabaritos ou resultados sem validação individual de liberação.
 return {active:true,months:access.activation.months,firstPaymentConfirmedDate:access.activation.firstPaymentConfirmedDate,subjects,progress:0,progressVerified:false};
}
