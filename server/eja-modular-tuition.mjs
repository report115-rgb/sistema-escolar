import {validId} from './security.mjs';
import {modularInstallments} from './eja-modular-plan.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function modularTuitionPreview(totalCents){
 if(!Number.isSafeInteger(totalCents)||totalCents<=0||totalCents>100000000)fail(400,'Informe valor total válido em centavos.');
 return [3,6,9].map(months=>({months,installmentsCents:modularInstallments(totalCents,months),totalCents}));
}
export async function modularTuitionAction(db,b,u){
 if(u.role!=='master')fail(403,'Acesso restrito ao Master.');
 const courseId=validId(b.courseId),courseRef=db.collection('courses').doc(courseId),doc=await courseRef.get();
 if(!doc.exists||doc.data().nivel!=='Supletivo'||doc.data().ejaMode!=='modular'||doc.data().ejaStage!=='medio')fail(409,'Curso EJA Modular do Ensino Médio inválido.');
 const ref=db.collection('se7EjaModularTuition').doc(courseId);
 if(b.operation==='read'){const old=await ref.get();return {courseId,totalCents:old.exists?old.data().totalCents:null,plans:old.exists?modularTuitionPreview(old.data().totalCents):[],enrollmentEnabled:false};}
 if(b.operation!=='save')fail(400,'Operação inválida.');
 const totalCents=b.totalCents,plans=modularTuitionPreview(totalCents);
 await ref.set({courseId,totalCents,updatedAt:new Date().toISOString(),updatedBy:u.uid},{merge:true});
 return {courseId,totalCents,plans,enrollmentEnabled:false};
}
