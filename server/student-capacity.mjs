import {randomUUID} from 'node:crypto';
import {validId,validCPF} from './security.mjs';
import {institutionDatabase} from './institution-scope.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const states={cancelamento:'Cancelado',transferencia:'Transferido',trancamento:'Trancado'};
export async function studentCapacity(raw,institutionId,user,b){
 const scoped=institutionDatabase(raw,institutionId),id=b.id?validId(b.id):randomUUID();
 const studentRef=scoped.collection('students').doc(id),usage=raw.collection('academicUsage').doc(institutionId),catalog=raw.collection('commercialPrivate').doc('catalog'),inbox=raw.collection('commercialPrivate').doc('notifications');
 const result=await raw.runTransaction(async tx=>{
 const [c,u,s,n]=await Promise.all([tx.get(catalog),tx.get(usage),tx.get(studentRef),tx.get(inbox)]);
 const institution=c.data()?.institutions?.find(i=>i.id===institutionId),plan=c.data()?.plans?.find(p=>p.id===institution?.plan);
 if(!institution||!plan||!Number.isInteger(plan.maxStudents)||plan.maxStudents<1)fail(409,'A instituição precisa de um plano com limite válido.');
 const limit=plan.maxStudents+(Number.isInteger(institution.additionalStudents)&&institution.additionalStudents>=0?institution.additionalStudents:0);
 let count;if(u.exists)count=u.data().activeStudents;else{const active=await tx.get(scoped.collection('students').where('status','==','Ativo'));count=active.size??active.docs.length;}
 if(!Number.isInteger(count)||count<0)fail(409,'A contagem da instituição precisa ser conferida.');
 let next,event=null,delta=0;const now=new Date().toISOString(),student=s.data();
 if(b.action==='platform-student-create'){
 if(s.exists)return {id,existing:true};const d=b.student;
 if(!d||typeof d.fullname!=='string'||!d.fullname.trim()||!validCPF(d.cpf))fail(400,'Informe nome e CPF válidos.');
 const fields=['fullname','dob','sexo','whatsapp','email','rg','cpf','cep','endereco','numero','bairro','cidade','estado','courseId','classId','poloId','poloName','fotoAluno'];next={};for(const key of fields){if(typeof d[key]==='string'){if(d[key].length>(key==='fotoAluno'?150000:1000))fail(400,'Informação do aluno muito grande.');next[key]=d[key];}}
 const [group,polo,duplicate]=await Promise.all([tx.get(scoped.collection('classes').doc(validId(d.classId))),tx.get(scoped.collection('polos').doc(validId(d.poloId))),tx.get(scoped.collection('students').where('cpf','==',d.cpf))]);
 if(duplicate.docs.length)fail(409,'Já existe aluno com este CPF nesta instituição.');if(!group.exists||group.data().courseId!==d.courseId||group.data().poloId!==d.poloId||!polo.exists||polo.data().active===false)fail(400,'Confira curso, turma e polo da matrícula.');
 next={...next,status:'Ativo',documentos:{},code:'MAT-'+new Date().getFullYear()+'-'+id.slice(0,8).toUpperCase(),enrollmentDate:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),enrollmentRegisteredAt:now};delta=1;
 }else{
 if(!s.exists)fail(404,'Aluno não encontrado.');const mode=b.mode,data=b.data||{},history=student.enrollmentHistory||[],actor={uid:user.uid,name:user.profile?.nome||user.name||user.email,role:user.role};let patch;
 if(mode==='reactivate'){
 if(!['Cancelado','Transferido','Trancado','Inativo'].includes(student.status)||student.enrollmentRequest)fail(409,'Conclua as pendências antes de reativar.');
 const group=await tx.get(scoped.collection('classes').doc(validId(data.classId)));if(!group.exists||group.data().poloId!==student.poloId)fail(400,'Escolha uma turma do mesmo polo.');
 event={id:randomUUID(),type:'reativacao',state:'efetivada',date:now.slice(0,10),reason:String(data.reason||'').slice(0,2000),previousStatus:student.status,newStatus:'Ativo',classId:data.classId,createdAt:now,actor};patch={status:'Ativo',classId:data.classId,courseId:group.data().courseId,enrollmentLastOperation:event};delta=1;
 }else if(['complete','dismiss'].includes(mode)){
 const request=student.enrollmentRequest;if(!request||request.id!==data.requestId||!states[request.type])fail(409,'A solicitação mudou. Atualize a tela.');if(mode==='complete'&&student.status!=='Ativo')fail(409,'O aluno não está ativo.');event={...request,id:randomUUID(),requestId:request.id,state:mode==='complete'?'efetivada':'retirada',previousStatus:student.status,newStatus:mode==='complete'?states[request.type]:student.status,createdAt:now,actor};patch={enrollmentRequest:null};if(mode==='complete'){patch.status=event.newStatus;patch.enrollmentLastOperation=event;delta=-1;}
 }else if(['direct','request'].includes(mode)){
 if(student.status!=='Ativo'||student.enrollmentRequest||!states[data.type]||typeof data.reason!=='string'||!data.reason.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(data.date||''))fail(400,'Confira os dados da operação de matrícula.');event={id:randomUUID(),type:data.type,state:mode==='request'?'pendente':'efetivada',date:data.date,reason:data.reason.slice(0,2000),previousStatus:student.status,newStatus:mode==='request'?student.status:states[data.type],createdAt:now,actor};patch=mode==='request'?{enrollmentRequest:event}:{status:event.newStatus,enrollmentLastOperation:event};if(mode==='direct')delta=-1;
 }else fail(400,'Operação inválida.');next={...patch,enrollmentHistory:[...history,event]};
 }
 const blocked=delta>0&&!institution.own&&count>=limit;
 const total=blocked?count:Math.max(0,count+delta),entries={...(n.data()?.entries||{})};const key='capacity_'+institutionId;
 if(!institution.own&&total>=limit){const old=entries[key];entries[key]={id:key,type:'capacity',institutionId,institutionName:institution.name,activeStudents:total,limit,at:old?.limit===limit?old.at:now,enforced:true};}else delete entries[key];
 tx.set(usage,{activeStudents:total,enforced:true,updatedAt:now});tx.set(inbox,{entries,updatedAt:now});
 if(!blocked){if(s.exists)tx.update(studentRef,next);else tx.create(studentRef,next);}
 return {id,event,blocked,limit};
 });
 if(result.blocked)fail(409,'O plano atingiu o limite de '+result.limit+' alunos ativos. Solicite a ampliação do plano para matricular ou reativar alunos.');return result;
}
