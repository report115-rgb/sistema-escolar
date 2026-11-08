import {validId} from './security.mjs';
import {modularInstallments} from './eja-modular-plan.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function modularBindFirstPayment(db,b,u){
 if(u.role!=='master')fail(403,'Acesso restrito ao Master.');
 const studentId=validId(b.studentId),invoiceId=validId(b.invoiceId),months=b.months;
 if(![3,6,9].includes(months))fail(400,'Selecione 3, 6 ou 9 meses.');
 const studentRef=db.collection('students').doc(studentId),studentDoc=await studentRef.get();
 if(!studentDoc.exists)fail(404,'Aluno não encontrado.');
 const student=studentDoc.data(),courseId=validId(student.courseId);
 const [course,tuition,invoice,reverse,planDoc]=await Promise.all([
  db.collection('courses').doc(courseId).get(),
  db.collection('se7EjaModularTuition').doc(courseId).get(),
  db.collection('se7AsaasInvoices').doc(invoiceId).get(),
  db.collection('financeLogs').doc(invoiceId).get(),
  db.collection('se7EjaModularFinancePlans').doc(studentId).get()
 ]);
 if(!course.exists||course.data().nivel!=='Supletivo'||course.data().ejaMode!=='modular'||course.data().ejaStage!=='medio')fail(409,'Aluno não pertence ao EJA Modular.');
 if(!tuition.exists)fail(409,'Configure o valor total do curso antes de vincular pagamentos.');
 if(!planDoc.exists)fail(409,'Salve o plano financeiro do aluno antes de vincular a primeira cobrança.');
 const plan=planDoc.data();
 if(plan.courseId!==courseId||plan.months!==months||plan.totalCents!==tuition.data().totalCents||plan.firstPaymentLinked)fail(409,'Plano financeiro divergente ou já vinculado.');
 const installments=modularInstallments(plan.totalCents,months);
 if(plan.firstInstallmentCents!==installments[0]||plan.installments?.length!==months)fail(409,'Plano financeiro inconsistente.');
 if(!invoice.exists||invoice.data().studentId!==studentId||invoice.data().state!=='linked'||!invoice.data().paymentId)fail(409,'Fatura não vinculada ao Asaas para este aluno.');
 if(invoice.data().amountCents!==installments[0])fail(409,'Primeira parcela não corresponde ao valor configurado para o prazo escolhido.');
 if(!reverse.exists||(reverse.data().studentId||reverse.data().alunoId)!==studentId)fail(409,'Registro financeiro divergente.');
 const paymentId=validId(invoice.data().paymentId),linkRef=db.collection('se7EjaModularPaymentLinks').doc(paymentId);
 const paymentReverse=await db.collection('se7AsaasPayments').doc(paymentId).get();
 if(!paymentReverse.exists||paymentReverse.data().studentId!==studentId||paymentReverse.data().invoiceId!==invoiceId||paymentReverse.data().superseded)fail(409,'Vínculo financeiro inconsistente.');
 const record={planVersion:plan.version,firstDueDate:plan.firstDueDate,type:'eja-modular-first-payment',studentId,courseId,invoiceId,paymentId,months,totalCents:tuition.data().totalCents,firstInstallmentCents:installments[0],createdAt:new Date().toISOString(),createdBy:u.uid};
 await db.runTransaction(async tx=>{
  const planRef=db.collection('se7EjaModularFinancePlans').doc(studentId);
  const [old,s,p,inv,paymentMap]=await Promise.all([tx.get(linkRef),tx.get(studentRef),tx.get(planRef),tx.get(db.collection('se7AsaasInvoices').doc(invoiceId)),tx.get(db.collection('se7AsaasPayments').doc(paymentId))]);
  if(!s.exists||s.data().courseId!==courseId||s.data().ejaModularActivation?.confirmed)fail(409,'Matrícula alterada ou já ativada.');
  if(!inv.exists||inv.data().paymentId!==paymentId||inv.data().state!=='linked'||inv.data().studentId!==studentId||inv.data().amountCents!==installments[0]||!paymentMap.exists||paymentMap.data().invoiceId!==invoiceId||paymentMap.data().studentId!==studentId)fail(409,'Vínculo Asaas alterado durante a operação.');
  if(!p.exists||p.data().version!==plan.version||p.data().firstPaymentLinked)fail(409,'Plano alterado ou cobrança já vinculada.');
  if(old.exists){const v=old.data();if(v.studentId!==studentId||v.invoiceId!==invoiceId||v.months!==months)fail(409,'Pagamento já vinculado a outro contrato.');return;}
  tx.create(linkRef,record);
  tx.update(planRef,{firstPaymentLinked:true,firstPaymentId:paymentId,firstInvoiceId:invoiceId,linkedAt:new Date().toISOString()});
 });
 return {linked:true,studentId,invoiceId,months,totalCents:record.totalCents,installmentsCents:installments,note:'Vínculo registrado. O curso só inicia após confirmação financeira do Asaas.'};
}
