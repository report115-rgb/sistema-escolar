import {api,config,cents,dueDate,linkCustomer,emit,importPayment} from './asaas.mjs';
import {randomUUID,createHash} from 'node:crypto';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const jobRef=(db,id)=>db.collection('se7EnrollmentBilling').doc(id);
export const enabled=()=>process.env.ASAAS_ENROLLMENT_AUTO_ENABLED==='true'&&config().enabled&&config().configured&&config().creationEnabled;

export function newInstallments(course,now=new Date()){
 const count=Number(course.qtdParcelas),amount=cents(course.valorParcela),discount=cents(course.valorDesconto||course.valorParcela),day=Number(course.vencimento||10);
 if(!Number.isInteger(count)||count<1||count>60||!Number.isInteger(day)||day<1||day>31||discount>amount)fail(409,'Configuração financeira do curso inválida.');
 const today=now.toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}),[year,month]=today.split('-').map(Number);let offset=0;
 const date=i=>{const first=new Date(Date.UTC(year,month-1+i,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return first.getUTCFullYear()+'-'+String(first.getUTCMonth()+1).padStart(2,'0')+'-'+String(Math.min(day,last)).padStart(2,'0');};
 if(date(0)<today)offset=1;return Array.from({length:count},(_,i)=>({date:date(i+offset),amount:amount/100,discountAmount:discount/100,description:'Mensalidade '+(i+1)+'/'+count+' - '+course.name}));
}
export async function markNew(db,id){await db.collection('se7EnrollmentCandidates').doc(id).set({version:1,createdAt:new Date().toISOString()});}
export async function start(db,id,u){
 if(!['master','secretaria','financeiro'].includes(u.role))fail(403,'Acesso restrito.');
 if(!enabled())return {enabled:false};
 const candidate=await db.collection('se7EnrollmentCandidates').doc(id).get();if(!candidate.exists)return {enabled:false,legacy:true};
 const s=await db.collection('students').doc(id).get();if(!s.exists||!s.data().classId||!s.data().courseId||!['Ativo','Ativa'].includes(s.data().status))return {enabled:true,state:'waiting',message:'Aguardando confirmação da turma e matrícula ativa.'};
 const turma=await db.collection('classes').doc(s.data().classId).get();if(!turma.exists||turma.data().courseId!==s.data().courseId)fail(409,'Confira o curso e a turma da matrícula.');
 await db.runTransaction(async tx=>{const ref=jobRef(db,id),old=await tx.get(ref);if(old.exists)return;tx.set(ref,{studentId:id,courseId:s.data().courseId,state:'pending',phase:'customer',cursor:0,entries:[],createdAt:new Date().toISOString(),actorUid:u.uid});});return {enabled:true,...await status(db,id)};
}
export async function status(db,id){const s=await jobRef(db,id).get();if(!s.exists)return {studentId:id,state:'none'};const j=s.data();return {studentId:id,state:j.state,phase:j.phase,completed:j.cursor||0,total:j.entries?.length||0,message:j.message||''};}
export async function retry(db,id,u){
 if(!['master','financeiro'].includes(u.role)||!enabled())fail(403,'Retomada exclusiva do master ou financeiro.');
 const ref=jobRef(db,id),snap=await ref.get();if(!snap.exists||snap.data().state!=='review')fail(409,'Integração não está aguardando revisão.');const j=snap.data(),patch={state:'pending',message:'',leaseUntil:0};
 if(['customer','customer_sending'].includes(j.phase)){const link=await db.collection('se7AsaasCustomers').doc(id).get();if(j.phase==='customer_sending'&&!link.exists)fail(409,'Primeiro confira o cliente no Asaas e vincule pelo CPF no financeiro. Não crie outro cadastro.');if(link.exists){patch.phase='plan';patch.customerId=link.data().customerId;}}
 await ref.update(patch);return status(db,id);
}
export async function list(db,u){if(!['master','financeiro'].includes(u.role))fail(403,'Acesso restrito.');if(!enabled())return {jobs:[]};const [r,review]=await Promise.all([db.collection('se7EnrollmentBilling').where('state','==','pending').limit(10).get(),db.collection('se7EnrollmentBilling').where('state','==','review').limit(10).get()]);return {jobs:r.docs.map(d=>d.id),reviews:review.docs.map(d=>({studentId:d.id,message:d.data().message||'Confira no financeiro.'}))};}
export async function step(db,id,u){
 if(!['master','secretaria','financeiro'].includes(u.role)||!enabled())fail(403,'Automação desativada ou acesso restrito.');
 const ref=jobRef(db,id),nonce=randomUUID();let job;
 await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)fail(404,'Integração não iniciada.');job=s.data();if(job.state!=='pending')return;if(job.leaseUntil>Date.now())fail(409,'Integração já está em processamento.');tx.update(ref,{lease:nonce,leaseUntil:Date.now()+120000});});
 if(job.state!=='pending')return status(db,id);
 try{
  const snap=await db.collection('students').doc(id).get(),s=snap.data();if(!s||!['Ativo','Ativa'].includes(s.status))fail(409,'Matrícula não está ativa.');if(job.courseId&&job.courseId!==s.courseId)fail(409,'Curso alterado durante a integração. Confira no financeiro.');
  if(job.phase==='customer'){
   const cpf=String(s.cpf||'').replace(/\D/g,'');if(cpf.length!==11)fail(409,'CPF inválido.');const found=await api('/customers?cpfCnpj='+cpf+'&limit=2');if(!Array.isArray(found.data)||found.hasMore||found.data.filter(c=>!c.deleted).length>1)fail(409,'Mais de um cliente com este CPF; revisão necessária.');
   let customer=found.data.find(c=>!c.deleted&&String(c.cpfCnpj||'').replace(/\D/g,'')===cpf);
   if(!customer){await ref.update({phase:'customer_sending'});const payload={name:s.fullname,cpfCnpj:cpf,externalReference:'se7:'+id,notificationDisabled:true};for(const [k,v]of Object.entries({email:s.email,mobilePhone:String(s.whatsapp||'').replace(/\D/g,''),postalCode:String(s.cep||'').replace(/\D/g,''),address:s.endereco||s.street,addressNumber:s.numero||s.number,province:s.bairro||s.neighborhood}))if(v)payload[k]=v;customer=await api('/customers','POST',payload);}
   await linkCustomer(db,id,customer.id,u);await ref.update({phase:'plan',customerId:customer.id,leaseUntil:0});return status(db,id);
  }
  if(job.phase==='customer_sending')fail(409,'Cadastro de cliente sem confirmação. Confira no Asaas antes de continuar.');
  if(job.phase==='plan'){
   const remote=await api('/payments?customer='+encodeURIComponent(job.customerId)+'&limit=100');if(!Array.isArray(remote.data))fail(502,'Resposta inesperada do Asaas.');if(remote.hasMore)fail(409,'Histórico extenso; revisão financeira necessária.');const payments=remote.data.filter(p=>!p.deleted);if(payments.length>60)fail(409,'Mais de 60 cobranças; revisão financeira necessária.');
   const local=await db.collection('financeLogs').where('studentId','==',id).get();const entries=[];
   if(payments.length){
    // Usa vencimentos e valores reais existentes; não emite nova cobrança nesse ramo.
    payments.sort((a,b)=>dueDate(a.dueDate).localeCompare(dueDate(b.dueDate))||a.id.localeCompare(b.id));
    const reverses=await Promise.all(payments.map(p=>db.collection('se7AsaasPayments').doc(p.id).get()));for(const [index,p] of payments.entries()){if(p.customer!==job.customerId)fail(409,'Cliente divergente.');const reverse=reverses[index];if(reverse.exists)fail(409,'Cobrança já vinculada. Revise os vínculos existentes.');cents(p.originalValue??p.value);dueDate(p.dueDate);entries.push({invoiceId:'auto_'+createHash('sha256').update(id+':'+p.id).digest('hex').slice(0,32),paymentId:p.id,amount:p.originalValue??p.value,date:p.dueDate,description:p.description||'Mensalidade '+(entries.length+1)+'/'+payments.length,mode:'import'});}
   }else{
    if(!local.docs.length){const c=await db.collection('courses').doc(s.courseId).get();if(!c.exists)fail(409,'Curso não encontrado.');for(const [i,row]of newInstallments(c.data()).entries())entries.push({...row,invoiceId:'enroll_'+id+'_'+(i+1),mode:'create'});}
    for(const d of local.docs){const f=d.data();cents(f.amount);dueDate(f.date);if(f.date<new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}))fail(409,'Primeiro vencimento passado. Ajuste as parcelas antes da emissão.');entries.push({invoiceId:d.id,mode:'create'});}
    if(local.docs.length)entries.sort((a,b)=>local.docs.find(d=>d.id===a.invoiceId).data().date.localeCompare(local.docs.find(d=>d.id===b.invoiceId).data().date));
   }
   if(entries.length>60)fail(409,'Mais de 60 cobranças; revisão necessária.');
   await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data().lease!==nonce)fail(409,'Processamento alterado.');const fresh=await Promise.all(local.docs.map(d=>tx.get(d.ref)));if(fresh.some((d,i)=>!d.exists||JSON.stringify(d.data())!==JSON.stringify(local.docs[i].data())))fail(409,'Parcelas alteradas durante a integração; revisão necessária.');const linked=await Promise.all(local.docs.map(d=>tx.get(db.collection('se7AsaasInvoices').doc(d.id))));if(linked.some(d=>d.exists))fail(409,'Parcelas já vinculadas; revisão necessária.');if(payments.length){for(const d of local.docs){if(!/^PENDENTE/.test(d.data().status||''))fail(409,'Parcela local já tratada; revisão necessária.');tx.delete(d.ref);}for(const e of entries)tx.set(db.collection('financeLogs').doc(e.invoiceId),{studentId:id,studentName:s.fullname,studentCode:s.code||'',description:e.description,amount:e.amount,date:e.date,status:'PENDENTE',enrollmentAuto:true});}else {for(const d of local.docs)tx.update(d.ref,{enrollmentAuto:true});if(!local.docs.length)for(const e of entries)tx.set(db.collection('financeLogs').doc(e.invoiceId),{studentId:id,studentName:s.fullname,studentCode:s.code||'',description:e.description,amount:e.amount,discountAmount:e.discountAmount,date:e.date,status:'PENDENTE',enrollmentAuto:true});}tx.update(ref,{entries,phase:'invoices',leaseUntil:0,mode:payments.length?'existing':'new'});});return status(db,id);
  }
  if(job.phase==='invoices'){
   const entry=job.entries[job.cursor];if(!entry){await ref.update({state:'done',leaseUntil:0,completedAt:new Date().toISOString()});return status(db,id);}
   const r=entry.mode==='import'?await importPayment(db,entry.invoiceId,entry.paymentId,u):await emit(db,entry.invoiceId,'BOLETO',u);if(r.review)fail(409,'Cobrança exige conferência.');await ref.update({cursor:job.cursor+1,state:job.cursor+1===job.entries.length?'done':'pending',leaseUntil:0});return status(db,id);
  }
  fail(409,'Etapa exige revisão financeira.');
 }catch(e){await ref.update({state:'review',message:String(e.message).slice(0,350),leaseUntil:0});return status(db,id);}
}
