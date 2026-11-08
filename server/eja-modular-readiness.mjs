import {validId} from './security.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function modularReadinessAction(db,b,u){
 if(u.role!=='master')fail(403,'Acesso exclusivo ao Master.');
 const courseId=validId(b.courseId);
 const doc=await db.collection('courses').doc(courseId).get();
 if(!doc.exists)fail(404,'Curso não encontrado.');
 const course=doc.data();
 if(course.nivel!=='Supletivo'||course.ejaMode!=='modular'||course.ejaStage!=='medio')fail(409,'Selecione um curso EJA Modular do Ensino Médio.');
 const subjects=course.subjects||[];
 if(!Array.isArray(subjects)||subjects.length>200)fail(409,'Disciplinas inválidas.');
 const rows=await Promise.all(subjects.map(async subject=>{
  const id=validId(subject.id),key=courseId+'_'+id;
  const [materialsDoc,examDoc]=await Promise.all([db.collection('se7EjaModularMaterials').doc(key).get(),db.collection('se7EjaModularExams').doc(key).get()]);
  const materials=materialsDoc.exists?materialsDoc.data():null,exam=examDoc.exists?examDoc.data():null;
  const materialReady=!!(materials?.ementa&&materials?.apostilaUrl&&Array.isArray(materials.lessons)&&materials.lessons.length===3&&materials.lessons.every(l=>l.title&&l.url));
  const examReady=!!(exam?.published&&Array.isArray(exam.questions)&&exam.questions.length===10);
  return {subjectId:id,subjectName:String(subject.name||subject.nome||id),materialsReady:materialReady,examReady,ready:materialReady&&examReady,materialsUpdatedAt:materials?.updatedAt||null,examPublishedAt:exam?.publishedAt||null};
 }));
 return {courseId,subjects:rows,readyCount:rows.filter(x=>x.ready).length,total:rows.length,allReady:rows.length>0&&rows.every(x=>x.ready),enrollmentEnabled:false,note:'Diagnóstico administrativo. Matrículas e liberação automática continuam bloqueadas até integração financeira e acadêmica.'};
}
