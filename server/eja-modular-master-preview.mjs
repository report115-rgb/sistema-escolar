import {validId} from './security.mjs';
import {modularCyclePlan} from './eja-modular-cycle.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function modularMasterPreview(db,b,u){
 if(u.role!=='master')fail(403,'Acesso exclusivo do Master.');
 if(b.operation!=='read')fail(400,'Operação não permitida.');
 const all=await db.collection('courses').where('ejaMode','==','modular').get();
 const courses=all.docs.filter(d=>d.data().nivel==='Supletivo'&&d.data().ejaStage==='medio');
 if(!courses.length)fail(404,'Curso EJA Modular não encontrado.');
 const doc=b.courseId?courses.find(d=>d.id===validId(b.courseId)):courses[0];
 if(!doc)fail(404,'Curso não encontrado.');
 const c=doc.data(),subjects=Array.isArray(c.subjects)?c.subjects:[];
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const plan=subjects.length?modularCyclePlan({subjects,months:3,firstPaymentConfirmedDate:today}):[];
 const details=await Promise.all(subjects.map(async subject=>{
  const id=validId(String(subject.id));
  const [m,e]=await Promise.all([db.collection('se7EjaModularMaterials').doc(doc.id+'_'+id).get(),db.collection('se7EjaModularExams').doc(doc.id+'_'+id).get()]);
  const mat=m.exists?m.data():null,exam=e.exists?e.data():null;
  return {subjectId:id,materials:mat?{apostilaUrl:mat.apostilaUrl||'',ementa:mat.ementa||'',lessons:Array.isArray(mat.lessons)?mat.lessons.map(l=>({number:l.number,title:l.title,url:l.url})):[]}:null,exam:exam?{published:exam.published===true,questions:Array.isArray(exam.questions)?exam.questions.map(q=>({enunciado:q.enunciado||'',imagem:q.imagem||'',opcoes:q.opcoes||[]})):[]}:null};
 }));
 return {preview:true,course:{id:doc.id,name:c.name||'EJA Modular',nivel:c.nivel,ejaMode:c.ejaMode,ejaStage:c.ejaStage,subjects},subjects:details,plan:plan.map(p=>({subjectId:p.subjectId,cycle:p.cycle,releaseDate:p.contentReleaseDate,lessons:p.lessons,examEarliestDate:p.examEarliestDate,examCloseAt:p.examCloseAt}))};
}