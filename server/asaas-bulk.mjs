import {randomBytes} from 'node:crypto';
import {invoices,candidates,importPayment,cents,dueDate} from './asaas.mjs';
import {FieldValue as F} from './admin.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const key=f=>cents(f.amount)+'|'+dueDate(f.date);
export async function preview(db,studentId,u){
 const local=(await invoices(db,studentId)).invoices;const rows=[];const counts=new Map();for(const f of local){if(f.link)continue;try{const k=key(f);counts.set(k,(counts.get(k)||0)+1);}catch{}}
 let remote=null;
 for(const f of local){const row={invoiceId:f.id,description:f.description,amount:f.amount??'',date:f.date,status:f.status};
  if(f.link){rows.push({...row,result:f.link.paymentId?'already':'busy',message:f.link.paymentId?'Já vinculada':'Operação anterior em conferência'});continue;}
  if(/PAGO|NEGOCIADO|ACORDO ACEITO|PROPOSTA|AGUARDANDO|CANCELADO|ESTORNADO/i.test(f.status)||/PROPOSTA|TERMO DE PROPOSTA/i.test(f.description)){rows.push({...row,result:'excluded',message:'Situação local exige revisão individual'});continue;}
  let k;try{k=key(f);}catch{rows.push({...row,result:'invalid',message:'Valor ou vencimento inválido'});continue;}
  // One Asaas listing per preview; candidates also verifies the linked customer's CPF.
  if(!remote)remote=await candidates(db,f.id);
  const matches=remote.payments.filter(p=>!p.alreadyLinked&&cents(p.value)+'|'+dueDate(p.dueDate)===k);
  const usable=matches.filter(p=>['PENDING','OVERDUE','CONFIRMED','RECEIVED','RECEIVED_IN_CASH'].includes(p.status));
  if(counts.get(k)>1||matches.length>1){rows.push({...row,result:'ambiguous',message:'Mais de uma mensalidade ou cobrança com o mesmo valor e vencimento'});continue;}
  if(usable.length!==1){rows.push({...row,result:'missing',message:matches.length?'Situação Asaas exige revisão individual':'Nenhuma correspondência disponível'});continue;}
  rows.push({...row,result:'ready',message:'Correspondência única encontrada',paymentId:usable[0].id,asaasStatus:usable[0].status});
 }
 const planId=randomBytes(24).toString('hex');await db.collection('se7AsaasBulkPlans').doc(planId).set({studentId,actor:u.uid,expiresAt:Date.now()+600000,entries:rows.filter(r=>r.result==='ready'),createdAt:F.serverTimestamp()});return {planId,studentId,rows,ready:rows.filter(r=>r.result==='ready').length};
}
export async function commitOne(db,planId,invoiceId,u){
 if(!/^[a-f0-9]{48}$/.test(planId)||typeof invoiceId!=='string')fail(400,'Prévia inválida.');const ref=db.collection('se7AsaasBulkPlans').doc(planId);const snap=await ref.get();const plan=snap.data();if(!snap.exists||plan.actor!==u.uid)fail(403,'Prévia não autorizada.');if(plan.expiresAt<Date.now())fail(409,'Prévia expirada. Busque os vínculos novamente.');const expected=plan.entries.find(e=>e.invoiceId===invoiceId);if(!expected)fail(400,'Mensalidade fora da prévia.');
 const all=(await invoices(db,plan.studentId)).invoices;const local=all.find(f=>f.id===invoiceId);if(!local||key(local)!==key(expected))fail(409,'Mensalidade alterada desde a prévia. Busque novamente.');
 if(local.link&&local.link.paymentId!==expected.paymentId)fail(409,'Vínculo ou operação alterada. Atualize a prévia.');
 // Refresh uniqueness immediately before committing; never trust browser-supplied payment IDs.
 if(!local.link){if(all.filter(f=>{if(f.link)return false;try{return key(f)===key(expected);}catch{return false;}}).length!==1)fail(409,'Há mensalidades duplicadas. Atualize a prévia.');const current=await candidates(db,invoiceId);const matches=current.payments.filter(p=>!p.alreadyLinked&&cents(p.value)+'|'+dueDate(p.dueDate)===key(expected));if(matches.length!==1||matches[0].id!==expected.paymentId)fail(409,'Correspondência alterada no Asaas. Revise individualmente.');}
 const result=await importPayment(db,invoiceId,expected.paymentId,u);await ref.update({['results.'+invoiceId]:{paymentId:expected.paymentId,actor:u.uid,completedAt:Date.now()}});return {invoiceId,ok:true,review:result.review===true};
}
