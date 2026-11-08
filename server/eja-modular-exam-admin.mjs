import {validId} from './security.mjs';
import {importSingleExamQuestions,newModularExam,prepareModularExam,validateModularQuestion} from './eja-modular-exams.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function modularExamAction(db,b,u){
 if(u.role!=='master')fail(403,'Acesso restrito ao master.');
 const courseId=validId(b.courseId),subjectId=validId(b.subjectId);
 const course=await db.collection('courses').doc(courseId).get();
 if(!course.exists||course.data().nivel!=='Supletivo'||course.data().ejaMode!=='modular'||course.data().ejaStage!=='medio')fail(409,'Curso EJA Modular Ensino Médio inválido.');
 const subject=(course.data().subjects||[]).find(s=>String(s.id)===subjectId);
 if(!subject)fail(404,'Disciplina não cadastrada no curso.');
 const subjectName=String(subject.name||subject.nome||'').trim();
 const ref=db.collection('se7EjaModularExams').doc(courseId+'_'+subjectId);
 if(b.operation==='read'){const doc=await ref.get();return {exam:doc.exists?doc.data():null};}
 if(b.operation==='import'||b.operation==='create'){
  const config=b.operation==='import'?await db.collection('config').doc('ejaSettings').get():null;
  const exam=b.operation==='import'?importSingleExamQuestions(config.data(),{subjectId,subjectName}):newModularExam({subjectId,subjectName});
  const value={...exam,courseId,subjectId,subjectName,createdAt:new Date().toISOString()};
  try{await ref.create(value);}catch(e){if(e.code===6||e.code==='already-exists')fail(409,'Já existe avaliação nesta disciplina.');throw e;}
  return {exam:value};
 }
 if(b.operation==='save'||b.operation==='publish'){
  const doc=await ref.get();if(!doc.exists)fail(404,'Avaliação não encontrada.');
  if(doc.data().published)fail(409,'A avaliação publicada está bloqueada para edição.');
  const questions=b.operation==='save'?(Array.isArray(b.questions)&&b.questions.length<=10?b.questions.map(validateModularQuestion):fail(400,'Máximo de dez questões.')):prepareModularExam(doc.data()).questions;
  const patch={questions,updatedAt:new Date().toISOString()};
  if(b.operation==='publish')Object.assign(patch,{published:true,publishedAt:patch.updatedAt});
  await ref.update(patch);return {exam:{...doc.data(),...patch}};
 }
 fail(400,'Operação inválida.');
}
