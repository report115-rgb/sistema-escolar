import {auditModularSubject} from './eja-modular-audit.mjs';
import {validId} from './security.mjs';
import {validateModularMaterials} from './eja-modular-materials.mjs';
import {prepareModularExam} from './eja-modular-exams.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function inspectModularSubject(subject,materials,exam){
 const issues=[];
 // 1: ementa; 2: apostila; 3-5: cada videoaula; 6: quantidade de aulas.
 if(!materials?.ementa?.trim())issues.push('Ementa não cadastrada');
 if(!materials?.apostilaUrl?.trim())issues.push('Apostila PDF não cadastrada');
 if(!Array.isArray(materials?.lessons)||materials.lessons.length!==3)issues.push('São necessárias três videoaulas');
 for(let i=0;i<3;i++)if(!materials?.lessons?.[i]?.title?.trim()||!materials?.lessons?.[i]?.url?.trim())issues.push('Videoaula '+(i+1)+' incompleta');
 // 7: validação de URLs; 8: publicação; 9: dez questões completas; 10: metadados de integridade.
 if(materials){try{validateModularMaterials(materials);}catch{issues.push('Materiais possuem formato ou links inválidos');}}
 if(!exam)issues.push('Avaliação não cadastrada');
 else{
  if(exam.published!==true)issues.push('Avaliação ainda não publicada');
  if(!Array.isArray(exam.questions)||exam.questions.length!==10)issues.push('Avaliação precisa de dez questões');
  else try{prepareModularExam({...exam,subjectId:String(subject.id),subjectName:String(subject.name||subject.nome||'Disciplina')});}catch{issues.push('Questões ou gabaritos incompletos');}
 }
 const materialsReady=!!materials&&!issues.some(x=>/Ementa|Apostila|videoaula|Materiais/.test(x));
 const examReady=!!exam&&!issues.some(x=>/Avaliação|Questões/.test(x));
 return {audit:auditModularSubject(subject,materials,exam),subjectId:String(subject.id),subjectName:String(subject.name||subject.nome||subject.id),materialsReady,examReady,ready:issues.length===0,issues,materialsUpdatedAt:materials?.updatedAt||null,examPublishedAt:exam?.publishedAt||null};
}
export async function modularReadinessAction(db,b,u){
 if(u.role!=='master')fail(403,'Acesso exclusivo ao Master.');
 const courseId=validId(b.courseId);
 const doc=await db.collection('courses').doc(courseId).get();
 if(!doc.exists)fail(404,'Curso não encontrado.');
 const course=doc.data();
 if(course.nivel!=='Supletivo'||course.ejaMode!=='modular'||course.ejaStage!=='medio')fail(409,'Selecione um curso EJA Modular do Ensino Médio.');
 const subjects=course.subjects||[];
 if(!Array.isArray(subjects)||subjects.length>200)fail(409,'Disciplinas inválidas.');
 const ids=new Set();
 const rows=await Promise.all(subjects.map(async subject=>{
  const id=validId(subject.id);if(ids.has(id))fail(409,'Há disciplinas com identificadores duplicados.');ids.add(id);
  const key=courseId+'_'+id;
  const [m,e]=await Promise.all([db.collection('se7EjaModularMaterials').doc(key).get(),db.collection('se7EjaModularExams').doc(key).get()]);
  return inspectModularSubject(subject,m.exists?m.data():null,e.exists?e.data():null);
 }));
 const issues=rows.reduce((n,s)=>n+s.issues.length,0);
 const auditPassed=rows.reduce((n,s)=>n+s.audit.filter(x=>x.ok).length,0);
 const auditTotal=rows.reduce((n,s)=>n+s.audit.length,0);
 return {courseId,subjects:rows,auditPassed,auditTotal,readyCount:rows.filter(x=>x.ready).length,total:rows.length,issueCount:issues,allReady:rows.length>0&&rows.every(x=>x.ready),enrollmentEnabled:false,note:'Diagnóstico administrativo, sem liberação de matrículas ou atividades. A integração financeira e acadêmica permanece pendente.'};
}
