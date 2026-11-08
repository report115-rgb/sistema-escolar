// Reaproveita o webhook Asaas existente; somente matrícula modular previamente vinculada.
import {validId} from './security.mjs';
const paid=new Set(['RECEIVED','CONFIRMED','RECEIVED_IN_CASH']);
export function modularActivationCandidate({payment,invoice,link,student,course}){
 if(!link||link.type!=='eja-modular-first-payment'||link.studentId!==student?.id||link.invoiceId!==invoice?.id||link.courseId!==course?.id||link.paymentId!==payment?.id)return null;
 if(!student||!course||student.courseId!==course.id||course.nivel!=='Supletivo'||course.ejaMode!=='modular'||course.ejaStage!=='medio')return null;
 if(![3,6,9].includes(link.months)||!paid.has(payment?.status)||payment.deleted||payment.refunded||payment.chargeback||payment.status==='REFUNDED'||payment.status==='CHARGEBACK_REQUESTED')return null;
 if(invoice.paymentId!==payment.id||invoice.state!=='linked'||invoice.partialRefund||invoice.superseded||invoice.payment?.status!==payment.status||!paid.has(invoice.payment?.status)||invoice.amountCents!==link.firstInstallmentCents||invoice.dueDate!==link.firstDueDate)return null;
 const date=invoice.payment?.paymentDate||payment.paymentDate||payment.clientPaymentDate;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z')))return null;
 return {confirmed:true,source:'asaas-webhook-confirmed',paymentId:payment.id,months:link.months,firstPaymentConfirmedDate:date};
}
export async function modularPaymentWebhook(db,payload){
 const paymentId=payload?.payment?.id;if(typeof paymentId!=='string'||!/^[-A-Za-z0-9_:]{1,128}$/.test(paymentId))return false;
 // Nenhuma leitura de matrícula por CPF, nome ou valor; vínculo explícito e único.
 const linkDoc=await db.collection('se7EjaModularPaymentLinks').doc(paymentId).get();
 if(!linkDoc.exists)return false;
 const link=linkDoc.data();
 if(!link||link.type!=='eja-modular-first-payment'||link.paymentId!==paymentId)return false;
 const sid=validId(link.studentId),invoiceId=validId(link.invoiceId),courseId=validId(link.courseId);
 const [studentDoc,courseDoc,invoiceDoc,reverseDoc,planDoc]=await Promise.all([db.collection('students').doc(sid).get(),db.collection('courses').doc(courseId).get(),db.collection('se7AsaasInvoices').doc(invoiceId).get(),db.collection('se7AsaasPayments').doc(paymentId).get(),db.collection('se7EjaModularFinancePlans').doc(sid).get()]);
 if(!studentDoc.exists||!courseDoc.exists||!invoiceDoc.exists||!reverseDoc.exists||!planDoc.exists||reverseDoc.data().studentId!==sid||reverseDoc.data().invoiceId!==invoiceId||reverseDoc.data().superseded)return false;
 const student={...studentDoc.data(),id:sid},course={...courseDoc.data(),id:courseId},invoice={...invoiceDoc.data(),id:invoiceId};
 if(student.courseId!==courseId||invoice.studentId!==sid||invoice.amountCents!==link.firstInstallmentCents||invoice.superseded)return false;
 const plan=planDoc.data();if(plan.studentId!==sid||plan.courseId!==courseId||!plan.firstPaymentLinked||plan.firstPaymentId!==paymentId||plan.firstInvoiceId!==invoiceId||plan.version!==link.planVersion||plan.months!==link.months||plan.totalCents!==link.totalCents||plan.firstInstallmentCents!==link.firstInstallmentCents||plan.firstDueDate!==link.firstDueDate||invoice.dueDate!==link.firstDueDate)return false;
 const candidate=modularActivationCandidate({payment:payload.payment,invoice,link,student,course});
 if(!candidate)return false;
 await db.runTransaction(async tx=>{
  const ref=db.collection('students').doc(sid),[fresh,currentPlan,currentInvoice]=await Promise.all([tx.get(ref),tx.get(db.collection('se7EjaModularFinancePlans').doc(sid)),tx.get(db.collection('se7AsaasInvoices').doc(invoiceId))]);
  if(!fresh.exists||fresh.data().courseId!==courseId||!currentPlan.exists||currentPlan.data().firstPaymentId!==paymentId||currentPlan.data().version!==link.planVersion||currentPlan.data().firstInvoiceId!==invoiceId||!currentInvoice.exists||currentInvoice.data().state!=='linked'||currentInvoice.data().payment?.status!==payload.payment.status)return;
  if(fresh.data().ejaModularActivation?.confirmed)return; // Idempotência: não reinicia cronograma.
  tx.update(ref,{ejaModularActivation:candidate});
 });
 return true;
}
