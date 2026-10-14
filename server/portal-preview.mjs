import {validId,publicStudent} from './security.mjs';
import * as exams from './exams.mjs';
import * as notices from './notices.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export async function preview(db,b,u){
 if(u.role!=='master')fail(403,'Visualização restrita ao master.');
 if(b.operation==='list'){const list=await db.collection('students').select('fullname','code','status').get();return {students:list.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.fullname||'').localeCompare(b.fullname||'','pt-BR'))};}
 const id=validId(b.studentId),doc=await db.collection('students').doc(id).get();if(!doc.exists)fail(404,'Aluno não encontrado.');
 const student=publicStudent(doc.data());const reader={...u,role:'aluno',studentId:id,student:{...student,portalMustChangePassword:false}};
 if(b.operation==='exam-results')return exams.results(db,reader);
 if(b.operation==='exam-result')return exams.resultDetail(db,{id:validId(b.id)},reader);
 if(b.operation==='notices-feed')return notices.feed(db,reader);
 if(b.operation==='notices-open')return notices.studentNotice(db,{id:validId(b.id)},reader);
 if(b.operation==='receipt'){const inv=await db.collection('financeLogs').doc(validId(b.invoiceId)).get();const f=inv.data();if(!f||(f.studentId||f.alunoId)!==id)fail(403,'Fatura de outro aluno.');const m=await db.collection('se7AsaasInvoices').doc(inv.id).get(),payment=m.data()?.payment;if(!payment||!['CONFIRMED','RECEIVED','RECEIVED_IN_CASH'].includes(payment.status)||payment.deleted||m.data().state==='review')fail(409,'Recibo ainda não disponível nos dados sincronizados.');const [inst,c,g]=await Promise.all([db.collection('config').doc('institution').get(),student.courseId?db.collection('courses').doc(validId(student.courseId)).get():null,student.classId?db.collection('classes').doc(validId(student.classId)).get():null]);const institution=inst.data()||{};return {payment,receipt:{student,institution:{name:institution.razao||institution.razão||institution.razaoSocial||institution.name||'',cnpj:institution.cnpj||'',address:institution.endereço||institution.address||institution.endereco||institution.end||'',logo:institution.logo||institution.logoUrl||institution.logomarca||''},course:c?.data()?.name||'',className:g?.data()?.name||'',studentName:student.fullname||'Aluno',description:f.description||f.descricao||'Mensalidade',invoiceId:inv.id,replacement:f.asaasReplacement===true,originalDueDate:f.asaasReplacementOriginalDueDate||'',originalAmountCents:f.asaasReplacementOriginalAmountCents??null}};}
 if(b.operation&&b.operation!=='snapshot')fail(403,'A visualização permite apenas consulta.');
 const [course,group,calendar,finance,institution,eja]=await Promise.all([
 student.courseId?db.collection('courses').doc(validId(student.courseId)).get():null,
 student.classId?db.collection('classes').doc(validId(student.classId)).get():null,
 student.classId?db.collection('academicCalendars').where('classId','==',student.classId).get():null,
 db.collection('financeLogs').where('studentId','==',id).get(),db.collection('config').doc('institution').get(),db.collection('config').doc('ejaSettings').get()
 ]);
 const inst=institution.data()||{},fields=['name','razao','cnpj','email','tel','end','loginDesc','logo','logomarca','urlLogo','logoUrl','image','fileUrl'];
 return {student:{id,...student},institution:Object.fromEntries(fields.filter(k=>typeof inst[k]==='string').map(k=>[k,inst[k]])),collections:{students:[{id,...student}],courses:course?.exists?[{id:course.id,...course.data()}]:[],classes:group?.exists?[{id:group.id,...group.data()}]:[],academicCalendars:calendar?.docs.map(d=>({id:d.id,...d.data()}))||[],financeLogs:finance.docs.map(d=>({id:d.id,...d.data()})),config:eja.exists?[{id:'ejaSettings',...eja.data()}]:[]}};
}
