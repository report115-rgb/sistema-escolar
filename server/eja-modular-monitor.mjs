import {validId} from './security.mjs';
import {modularCyclePlan,modularExamWindow} from './eja-modular-cycle.mjs';
import {studentModularAccess} from './eja-modular-student.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
// Read-only academic monitoring; no writes to historical grades or enrollment records.
export async function modularAcademicMonitorAction(db,b,u){
 if(!['master','secretaria'].includes(u.role))fail(403,'Acesso restrito à gestão acadêmica.');
 const courseId=validId(b.courseId),studentId=validId(b.studentId);
 const [courseDoc,studentDoc]=await Promise.all([db.collection('courses').doc(courseId).get(),db.collection('students').doc(studentId).get()]);
 if(!courseDoc.exists||!studentDoc.exists)fail(404,'Curso ou matrícula não encontrados.');
 const course={...courseDoc.data(),id:courseId},student=studentDoc.data();
 if(student.courseId!==courseId)fail(403,'Matrícula não pertence ao curso.');
 const access=studentModularAccess(student,course);
 if(!access.active)return {active:false,reason:access.reason,studentId,courseId,subjects:[]};
 const plan=modularCyclePlan({subjects:course.subjects,months:access.activation.months,firstPaymentConfirmedDate:access.activation.firstPaymentConfirmedDate});
 const rows=await Promise.all(plan.map(async (p,i)=>{
  const ref=db.collection('se7EjaModularAttempts').doc(studentId+'_'+courseId+'_'+p.subjectId);
  const doc=await ref.get(),a=doc.exists?doc.data():null;
  const valid=a&&a.studentId===studentId&&a.courseId===courseId&&a.subjectId===p.subjectId;
  const ended=valid&&(a.status==='completed'||a.status==='expired');
  const window=modularExamWindow(p);
  const subject=course.subjects[i];
  return {subjectId:p.subjectId,subjectName:String(subject?.name||subject?.nome||p.subjectId),status:ended?a.status:valid&&a.status==='in_progress'?(window.expired?'pending_expiry':'in_progress'):window.expired?'not_started_expired':window.notYetOpen?'scheduled':'not_started',submittedCount:valid?Object.keys(a.answers||{}).length:0,grade:ended?a.grade:null,approved:ended?a.approved:null,examOpenAt:p.examOpenAt,examCloseAt:p.examCloseAt};
 }));
 return {active:true,studentId,courseId,subjects:rows,total:rows.length,completed:rows.filter(x=>x.grade!==null).length,approved:rows.filter(x=>x.approved===true).length,source:'se7EjaModularAttempts',note:'Consulta acadêmica; não substitui o lançamento oficial no histórico escolar.'};
}
