// Plano financeiro EJA Modular: planejamento administrativo sem emissão de cobranças.
import {validId} from './security.mjs';
import {modularInstallments,modularReleaseDate} from './eja-modular-plan.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const duration=v=>{if(![3,6,9].includes(v))fail(400,'Escolha 3, 6 ou 9 meses.');return v;};
const total=v=>{if(!Number.isSafeInteger(v)||v<=0||v>100000000)fail(409,'Valor total do curso inválido.');return v;};
export function buildModularFinanceSchedule({totalCents,months,firstDueDate}){
 duration(months);total(totalCents);
 const amounts=modularInstallments(totalCents,months);
 const dueDates=amounts.map((_,i)=>modularReleaseDate(firstDueDate,i));
 if(amounts.some(v=>!Number.isSafeInteger(v)||v<=0))fail(409,'Cada mensalidade deve ter valor positivo.');
 if(new Set(dueDates).size!==months)fail(409,'Vencimentos duplicados no plano.');
 const installments=amounts.map((amountCents,i)=>({number:i+1,amountCents,dueDate:dueDates[i],status:'planned'}));
 if(installments.some((p,i)=>i>0&&p.dueDate<=installments[i-1].dueDate))fail(409,'Vencimentos fora da ordem cronológica.');
 if(installments.reduce((n,p)=>n+p.amountCents,0)!==totalCents)fail(500,'Parcelamento inconsistente.');
 return {months,totalCents,firstDueDate,installments,installmentCount:months,firstInstallmentCents:amounts[0],lastDueDate:dueDates.at(-1),billingCreated:false};
}
export function validateModularFinancePlan(plan){
 if(!plan||typeof plan!=='object')fail(409,'Plano financeiro inexistente.');
 const expected=buildModularFinanceSchedule({totalCents:plan.totalCents,months:plan.months,firstDueDate:plan.firstDueDate});
 if(plan.installmentCount!==expected.installmentCount||plan.firstInstallmentCents!==expected.firstInstallmentCents||plan.lastDueDate!==expected.lastDueDate||!Array.isArray(plan.installments)||plan.installments.length!==expected.installments.length)fail(409,'Plano financeiro inconsistente.');
 for(let i=0;i<expected.installments.length;i++){
  const a=plan.installments[i],b=expected.installments[i];
  if(!a||a.number!==b.number||a.amountCents!==b.amountCents||a.dueDate!==b.dueDate||!['planned','linked','paid'].includes(a.status))fail(409,'Parcela divergente do contrato.');
 }
 return expected;
}
export async function modularFinancePlanAction(db,b,u){
 if(u.role!=='master')fail(403,'Acesso restrito ao Master.');
 const studentId=validId(b.studentId),ref=db.collection('se7EjaModularFinancePlans').doc(studentId);
 const studentRef=db.collection('students').doc(studentId),student=await studentRef.get();
 if(!student.exists)fail(404,'Matrícula não encontrada.');
 const s=student.data(),courseId=validId(s.courseId);
 if(b.courseId&&validId(b.courseId)!==courseId)fail(403,'Aluno não pertence ao curso selecionado.');
 const [course,tuition,existing]=await Promise.all([
  db.collection('courses').doc(courseId).get(),
  db.collection('se7EjaModularTuition').doc(courseId).get(),
  ref.get()
 ]);
 if(!course.exists||course.data().nivel!=='Supletivo'||course.data().ejaMode!=='modular'||course.data().ejaStage!=='medio')fail(409,'Aluno não pertence ao EJA Modular do Ensino Médio.');
 if(b.operation==='read')return {studentId,courseId,configuredTotalCents:tuition.exists?tuition.data().totalCents:null,plan:existing.exists?existing.data():null,activated:!!s.ejaModularActivation?.confirmed,editable:!s.ejaModularActivation?.confirmed&&!existing.data()?.firstPaymentLinked&&!existing.data()?.firstPaymentId&&!existing.data()?.firstInvoiceId};
 if(!tuition.exists)fail(409,'Cadastre primeiro o valor total do curso.');
 const totalCents=total(tuition.data().totalCents);
 if(b.operation==='preview')return {studentId,courseId,plan:buildModularFinanceSchedule({totalCents,months:b.months,firstDueDate:b.firstDueDate}),saved:false};
 if(b.operation!=='save')fail(400,'Operação inválida.');
 if(s.ejaModularActivation?.confirmed)fail(409,'Curso já ativado. Não altere o plano contratado.');
 if(existing.exists&&(existing.data().firstPaymentLinked||existing.data().firstPaymentId||existing.data().firstInvoiceId))fail(409,'Plano já vinculado a uma cobrança.');
 const expectedVersion=b.expectedVersion;
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)fail(400,'Atualize a consulta antes de salvar.');
 const proposed=buildModularFinanceSchedule({totalCents,months:b.months,firstDueDate:b.firstDueDate});
 let saved;
 await db.runTransaction(async tx=>{
  const [fresh,old,config]=await Promise.all([tx.get(studentRef),tx.get(ref),tx.get(db.collection('se7EjaModularTuition').doc(courseId))]);
  if(!fresh.exists||fresh.data().courseId!==courseId||fresh.data().ejaModularActivation?.confirmed)fail(409,'Matrícula alterada ou ativada.');
  if(!config.exists||config.data().totalCents!==totalCents)fail(409,'Valor total alterado. Refaça a prévia.');
  const version=old.exists?(old.data().version||0):0;
  if(version!==expectedVersion)fail(409,'Plano modificado por outro usuário. Atualize antes de salvar.');
  if(old.exists&&(old.data().firstPaymentLinked||old.data().firstPaymentId||old.data().firstInvoiceId))fail(409,'Primeira cobrança já vinculada. O plano está bloqueado.');
  saved={...proposed,studentId,courseId,version:version+1,createdAt:old.exists?old.data().createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),updatedBy:u.uid,firstPaymentLinked:false};
  tx.set(ref,saved);
 });
 return {studentId,courseId,plan:saved,saved:true};
}
