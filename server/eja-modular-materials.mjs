import {validId} from './security.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function validateModularMaterials(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Materiais inválidos.');
 const ementa=String(input.ementa||'').trim();if(ementa.length>12000)fail(400,'Ementa muito extensa.');
 const apostilaUrl=String(input.apostilaUrl||'').trim();if(apostilaUrl){let url;try{url=new URL(apostilaUrl);}catch{fail(400,'Link da apostila inválido.');}if(url.protocol!=='https:'||apostilaUrl.length>2000)fail(400,'Apostila deve ter endereço HTTPS.');}
 if(!Array.isArray(input.lessons)||input.lessons.length!==3)fail(400,'Cadastre exatamente três videoaulas.');
 const lessons=input.lessons.map((l,i)=>{const title=String(l?.title||'').trim(),url=String(l?.url||'').trim();if(title.length>180||url.length>2000)fail(400,'Videoaula inválida.');if(url){let parsed;try{parsed=new URL(url);}catch{fail(400,'Link da videoaula inválido.');}if(parsed.protocol!=='https:')fail(400,'A videoaula deve usar HTTPS.');}return {number:i+1,title,url};});
 return {ementa,apostilaUrl,lessons};
}
export async function modularMaterialsAction(db,b,u){
 if(u.role!=='master')fail(403,'Acesso restrito ao master.');
 const courseId=validId(b.courseId),subjectId=validId(String(b.subjectId??''));
 const course=await db.collection('courses').doc(courseId).get();
 if(!course.exists||course.data().nivel!=='Supletivo'||course.data().ejaMode!=='modular'||course.data().ejaStage!=='medio')fail(409,'Curso modular inválido.');
 const subject=(course.data().subjects||[]).find(s=>String(s.id)===subjectId);
 if(!subject)fail(404,'Disciplina não encontrada.');
 const ref=db.collection('se7EjaModularMaterials').doc(courseId+'_'+subjectId);
 if(b.operation==='read'){const doc=await ref.get();return {materials:doc.exists?doc.data():null};}
 if(b.operation==='save'){
  const clean=validateModularMaterials(b.materials);
  const complete=!!(clean.ementa&&clean.apostilaUrl&&clean.lessons.every(l=>l.title&&l.url));
  const value={...clean,courseId,subjectId,subjectName:String(subject.name||subject.nome||''),complete,updatedAt:new Date().toISOString()};
  await ref.set(value,{merge:true});return {materials:value};
 }
 fail(400,'Operação inválida.');
}
