import {validId} from './security.mjs';
import {modularInstallments} from './eja-modular-plan.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function modularTuitionPreview(totalCents){
 if(!Number.isSafeInteger(totalCents)||totalCents<=0||totalCents>100000000)fail(400,'Informe valor total válido em centavos.');
 return [3,6,9].map(months=>({months,installmentsCents:modularInstallments(totalCents,months),totalCents}));
}

const dateValue=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail(400,'Informe uma data válida.');
 const [y,m,d]=value.split('-').map(Number);
 const dt=new Date(Date.UTC(y,m-1,d));
 if(dt.toISOString().slice(0,10)!==value)fail(400,'Data de calendário inválida.');
 return value;
};
const isOverlap=(a,b)=>a.startDate<=(b.endDate||'9999-12-31')&&b.startDate<=(a.endDate||'9999-12-31');
const asPlans=data=>Array.isArray(data?.pricePlans)?data.pricePlans:[];
export async function modularTuitionAction(db,b,u){
 if(u.role!=='master')fail(403,'Acesso restrito ao Master.');
 const courseId=validId(b.courseId),courseRef=db.collection('courses').doc(courseId),doc=await courseRef.get();
 if(!doc.exists||doc.data().nivel!=='Supletivo'||doc.data().ejaMode!=='modular'||doc.data().ejaStage!=='medio')fail(409,'Curso EJA Modular do Ensino Médio inválido.');
 const ref=db.collection('se7EjaModularTuition').doc(courseId);
 if(b.operation==='read'){
  const old=await ref.get(),data=old.exists?old.data():{};
  return {courseId,totalCents:data.totalCents??null,plans:data.totalCents?modularTuitionPreview(data.totalCents):[],pricePlans:asPlans(data),enrollmentEnabled:false};
 }
 if(!['save','save-plan'].includes(b.operation))fail(400,'Operação inválida.');
 if(b.operation==='save'){
  // Compatibilidade com clientes antigos: não apagar o histórico de preços.
  const totalCents=b.totalCents,plans=modularTuitionPreview(totalCents);
  await ref.set({courseId,totalCents,updatedAt:new Date().toISOString(),updatedBy:u.uid},{merge:true});
  return {courseId,totalCents,plans,enrollmentEnabled:false};
 }
 const totalCents=b.totalCents;modularTuitionPreview(totalCents);
 const startDate=dateValue(b.startDate);
 const endDate=b.endDate==null?null:dateValue(b.endDate);
 if(endDate&&endDate<startDate)fail(400,'A data final deve ser igual ou posterior à inicial.');
 const planId=b.planId==null?null:validId(b.planId);
 let saved;
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref),data=snap.exists?snap.data():{},existing=asPlans(data);
  const previous=planId?existing.find(p=>p.id===planId):null;
  if(planId&&!previous)fail(404,'Plano não encontrado. Atualize a lista.');
  const candidate={id:planId||db.collection('se7EjaModularPriceIds').doc().id,totalCents,startDate,endDate,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),updatedBy:u.uid};
  const conflict=existing.find(p=>p.id!==candidate.id&&isOverlap(p,candidate));
  if(conflict)fail(409,'Período já pertence a outro plano ('+conflict.startDate+' até '+(conflict.endDate||'prazo indeterminado')+'). Edite o plano existente.');
  const next=existing.filter(p=>p.id!==candidate.id).concat(candidate).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  // Manter valor legado para compatibilidade, sem modificar contratos anteriores.
  tx.set(ref,{courseId,pricePlans:next,updatedAt:new Date().toISOString(),updatedBy:u.uid},{merge:true});
  saved=candidate;
 });
 return {courseId,pricePlan:saved,saved:true,enrollmentEnabled:false};
}
