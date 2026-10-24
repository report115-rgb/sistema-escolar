import {readInbox,writeInbox} from './eja-inbox.mjs';
import {addDays,localDate,windowFor} from './eja-policy.mjs';
const fail=(status,m)=>{throw Object.assign(Error(m),{status});};
export const feeTerm=t=>typeof t==='string'&&/^r[1-9]\d{0,3}$/.test(t);
export function scheduleView(c,s,m={},attempt=null,now=new Date()){
 let exam=c?.exam||m.exam||null;if(!exam&&s.controleEJA?.dataInicio){const date=s.controleEJA.dataInicio.slice(0,10);try{exam={date,...windowFor(date)};}catch{}}
 const missed=!!exam&&!attempt&&now>=new Date(exam.cutoffAt),key=exam?.date||'',entry=Object.entries(m.fees||{}).find(([,f])=>f.examKey===key&&!f.consumedAt),fee=entry?{term:entry[0],...entry[1]}:null;
 const earliest=c?.earliestExamDate||(s.enrollmentDate?addDays(s.enrollmentDate,30):null),tomorrow=addDays(localDate(now),1),minDate=missed?(earliest&&earliest>tomorrow?earliest:tomorrow):earliest;
 return {exam,missed,fee:fee?{term:fee.term,state:fee.state,amountCents:fee.amountCents,dueDate:fee.dueDate}:null,minDate,feeCents:3000,hasRescheduleBilling:Object.keys(m.fees||{}).length>0,proposal:m.proposal?.forExamKey===key?m.proposal:null};
}
export function feeContract(meta,term,student){const f=meta?.fees?.[term];if(!feeTerm(term)||!f)fail(404,'Taxa não solicitada.');return {paymentMode:'boleto',studentName:student.fullname,firstCents:f.amountCents,secondCents:f.amountCents,firstDueDate:f.dueDate,secondDueDate:f.dueDate,cardInstallments:0};}
export async function schedulingAction(db,b,u,sid,student){const cr=db.collection('se7EjaContracts').doc(sid),mr=db.collection('se7EjaReschedules').doc(sid),ar=db.collection('se7EjaAttempts').doc(sid),sr=db.collection('students').doc(sid);let result;const now=new Date();
 await db.runTransaction(async tx=>{const [cs,ms,a,ss]=await Promise.all([tx.get(cr),tx.get(mr),tx.get(ar),tx.get(sr)]);const c=cs.data(),m=ms.data()||{},s=ss.data(),v=scheduleView(c,s,m,a.exists?a.data():null,now);if(!['Ativo','Ativa'].includes(s.status))fail(403,'Matrícula indisponível.');if(a.exists&&!(b.action==='eja-admin-rebook'&&a.data()?.state==='finished'))fail(409,'Uma prova em andamento não pode ser substituída.');if(c&&c.paymentState!=='confirmed')fail(403,'Aguarde a confirmação do primeiro pagamento.');

 if(b.action==='eja-admin-rebook'){
  if(u.role!=='master')fail(403,'Somente o Master pode autorizar isenção de reagendamento.');
  // A tentativa concluída será arquivada integralmente, antes de liberar outra.
  if(typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date))fail(400,'Selecione uma data válida.');
  const exam=windowFor(b.date);
  if(b.date<localDate(now))fail(409,'Escolha hoje ou uma data futura.');
  if(b.date===localDate(now)&&now>=new Date(exam.cutoffAt))fail(409,'O horário de início da prova de hoje já terminou (20h). Escolha outra data.');
  if(Object.keys(m.fees||{}).length>0)fail(409,'Não é possível habilitar o agendamento: já foi gerado um boleto de reagendamento para este aluno. Consulte o Financeiro.');
  const stamp=now.toISOString(),next={date:b.date,...exam};
  if(a.exists){const previous=a.data();const archive=db.collection('se7EjaAttemptHistory').doc(sid+'_'+String(previous.startedAt||previous.finishedAt||stamp).replace(/[^0-9]/g,''));tx.create(archive,{...previous,studentId:sid,archivedAt:stamp,archivedBy:u.uid,archiveReason:String(b.reason||'Teste administrativo').slice(0,180)});tx.delete(ar);}

  const inboxes=await readInbox(tx,db,s.poloId);
  tx.set(mr,{exam:next,proposal:null,adminWaiver:{date:b.date,previousDate:v.exam?.date||null,grantedBy:u.uid,grantedAt:stamp,amountCents:3000,reason:'Liberação administrativa sem cobrança'}},{merge:true});
  if(cs.exists)tx.update(cr,{exam:next,scheduledAt:stamp,scheduledBy:u.uid});
  tx.set(sr,{controleEJA:{...(s.controleEJA||{}),dataInicio:next.startAt,dataFim:next.cutoffAt,provaAtiva:true}},{merge:true});
  tx.set(db.collection('systemLogs').doc(),{createdAt:stamp,actorUid:u.uid,usuario:u.name||u.uid,modulo:'EJA',acao:'Master autorizou novo agendamento isento de R$ 30,00',studentId:sid,previousDate:v.exam?.date||null,newDate:b.date});
  writeInbox(tx,inboxes,{type:'exam_scheduled',studentId:sid,studentName:s.fullname,poloId:s.poloId||'',at:stamp,message:'Master liberou reagendamento da prova EJA para '+b.date+' com isenção da taxa.'});
  result={scheduled:true,waived:true,date:b.date,previousArchived:a.exists};return;
 }
 if(b.action==='eja-reschedule-request'){
 if(u.role!=='aluno'||b.acceptFee!==true)fail(403,'O aluno deve confirmar a taxa de R$ 30,00.');if(!v.missed)fail(409,'A taxa só é necessária após perder a data sem iniciar a prova.');if(v.fee){result={term:v.fee.term};return;}const cycle=Math.max(0,...Object.keys(m.fees||{}).map(t=>Number(t.slice(1))||0))+1;if(cycle>9999)fail(409,'Solicite revisão do cadastro.');const term='r'+cycle,due=addDays(localDate(now),2),fee={amountCents:3000,dueDate:due,examKey:v.exam.date,state:'pending',requestedAt:now.toISOString()};tx.set(mr,{fees:{[term]:fee}},{merge:true});const id='eja_'+sid+'_'+term;tx.create(db.collection('se7EjaBillingJobs').doc(id),{studentId:sid,term,state:'pending',phase:'customer',createdAt:now.toISOString()});tx.create(db.collection('financeLogs').doc(id),{studentId:sid,studentName:s.fullname,description:'EJA — taxa de reagendamento da prova',amount:30,date:due,status:'PENDENTE',ejaManaged:true,ejaTerm:term});result={term};return;
 }
 const exam=windowFor(b.date);if(b.date<localDate(now)||now>=new Date(exam.cutoffAt))fail(409,'Escolha uma data futura disponível.');
 if(b.action==='eja-schedule-propose'){
 if(!['master','secretaria'].includes(u.role))fail(403,'Proposta restrita à secretaria.');if(v.missed)fail(403,'Após perder a data, somente o aluno pode pagar e reagendar pelo aplicativo.');if(!v.exam)fail(409,'O primeiro agendamento deve ser feito pelo aluno no aplicativo.');tx.set(mr,{proposal:{date:b.date,forExamKey:v.exam.date,by:u.uid,at:now.toISOString()}},{merge:true});result={proposed:true};return;
 }
 if(u.role!=='aluno')fail(403,'Somente o aluno confirma e salva o agendamento.');if(v.exam&&!v.missed&&b.date!==v.exam.date&&b.date!==v.proposal?.date)fail(403,'Solicite a alteração da data à secretaria e confirme a proposta no aplicativo.');if(!v.minDate)fail(409,'Solicite à secretaria o registro da data de matrícula.');if(b.date<v.minDate)fail(409,'Sua prova poderá ser realizada a partir de '+v.minDate.split('-').reverse().join('/')+'.');if(v.missed&&v.fee?.state!=='confirmed')fail(403,'Confirme o pagamento da taxa de R$ 30,00 para reagendar.');
 const inboxes=await readInbox(tx,db,s.poloId);const patch={exam:{date:b.date,...exam},proposal:null,...(v.missed?{fees:{[v.fee.term]:{...m.fees[v.fee.term],consumedAt:now.toISOString(),newDate:b.date}}}:{})};tx.set(mr,patch,{merge:true});writeInbox(tx,inboxes,{type:'exam_scheduled',studentId:sid,studentName:s.fullname,poloId:s.poloId||'',at:now.toISOString(),message:'Aluno confirmou agendamento da prova EJA para '+b.date+' • 08h às 20h.'});if(cs.exists)tx.update(cr,{exam:patch.exam,scheduledAt:now.toISOString(),scheduledBy:u.uid});tx.set(sr,{controleEJA:{dataInicio:exam.startAt,dataFim:exam.cutoffAt,provaAtiva:!cs.exists}},{merge:true});tx.set(db.collection('systemLogs').doc(),{createdAt:now.toISOString(),actorUid:u.uid,usuario:s.fullname,modulo:'EJA',acao:'Aluno confirmou agendamento da prova para '+b.date});result={scheduled:true};
 });return result;
}
