import * as academicIngress from '../server/academic-ingress.mjs';
import {today as enrollmentToday,planEntry} from '../assets/se7-ingress-policy.js';
import * as enrollmentAsaas from '../server/enrollment-asaas.mjs';
import {preview as portalPreview} from '../server/portal-preview.mjs';
import * as exams from '../server/exams.mjs';
import {reviewLocal} from '../server/enrollment-finance.mjs';
import * as notices from '../server/notices.mjs';
import * as financeBatch from '../server/finance-batch.mjs';
import * as mail from '../server/email.mjs';
import {waConfig,setConsent,enrollmentNotifications,examNotification,listMessages,sendJob,checkConnection,centralTest} from '../server/whatsapp.mjs';
import {services,FieldValue as F} from '../server/admin.mjs';
import {randomBytes} from 'node:crypto';
import * as asaas from '../server/asaas.mjs';
import * as replacement from '../server/asaas-replacement.mjs';
import * as asaasBulk from '../server/asaas-bulk.mjs';
import {roles,tabs,docTypes,digest,cpfKey,studentUid,alias,validId,password,hashPassword,verifyPassword,publicStudent,validCPF} from '../server/security.mjs';
const PROJECT='sistema-escolar-nuvem';
const APIKEY='AIzaSyBeJ-fqzwiQt0PZEKQ6e8zAPSuh7WRuaHo';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const at=()=>F.serverTimestamp();
async function authPassword(email,senha){const r=await fetch(`${process.env.NODE_ENV==='test'&&process.env.FIREBASE_AUTH_EMULATOR_HOST?'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1':'https://identitytoolkit.googleapis.com/v1'}/accounts:signInWithPassword?key=${APIKEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:senha,returnSecureToken:true}),signal:AbortSignal.timeout(10000)});const d=await r.json();return r.ok?d:null;}
async function limits(db,req,action,account=''){
 const ip=req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown';const bucket=Math.floor(Date.now()/900000);
 for(const [key,max] of [[`ip:${ip}`,action.startsWith('audit:')?300:action.startsWith('gateway:')?600:action.startsWith('email-send:')?2000:action.startsWith('asaas-bulk:')?180:action==='signup'?8:40],...(account?[[`account:${account}`,12]]:[])]){
  const ref=db.collection('se7RateLimits').doc(digest(`${action}:${key}:${bucket}`));
  await db.runTransaction(async tx=>{const snap=await tx.get(ref);const count=snap.exists?snap.data().count:0;if(count>=max)fail(429,'Muitas tentativas. Aguarde 15 minutos.');tx.set(ref,{count:count+1,expiresAt:new Date((bucket+2)*900000)});});
 }
}
async function identity(auth,db,req){
 const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)fail(401,'Entre novamente.');
 let user;try{user=await auth.verifyIdToken(token,true);}catch{fail(401,'Sessão inválida. Entre novamente.');}
 if(user.uid===process.env.SE7_MASTER_UID)return {...user,role:'master'};
 const staff=await db.collection('se7Staff').doc(user.uid).get();if(staff.exists&&!staff.data().disabled)return {...user,role:staff.data().perfil,profile:staff.data()};
 const sid=user.studentId;if(!sid)fail(403,'Conta sem permissão. Contate o master.');
 const doc=await db.collection('students').doc(validId(sid)).get();const s=doc.exists?doc.data():null;
 if(!s||s.se7AuthUid!==user.uid||s.portalBlocked||s.se7AuthLock||(s.portalSessionVersion||0)!==(user.portalVersion||0))fail(403,'Acesso alterado. Entre novamente ou contate a instituição.');
 if(s.portalMustChangePassword&&(!s.portalTemporaryExpiresAt||Date.parse(s.portalTemporaryExpiresAt)<Date.now()))fail(403,'Senha temporária expirada.');
 return {...user,role:'aluno',studentId:sid,student:s};
}
const master=u=>{if(u.role!=='master')fail(403,'Acesso restrito ao master.');};
async function audit(db,id,u,action){await db.collection('students').doc(id).collection('portalAdminEvents').add({action,actorName:u.name||u.email||'Master',actorEmail:u.email||'',at:at()});}
async function claims(auth,uid,values){const user=await auth.getUser(uid);await auth.setCustomUserClaims(uid,{...user.customClaims,...values});}
async function prepareStudent(db,doc){
 const s=doc.data();const cpf=String(s.cpf||'').replace(/\D/g,'');if(cpf.length!==11)fail(400,`Aluno ${doc.id}: CPF ausente ou inválido.`);
 const idx=db.collection('se7CpfIndex').doc(cpfKey(cpf));const priv=db.collection('se7Credentials').doc(doc.id);
 const cred=s.portalCredential|| (s.senhaAluno||s.code?await hashPassword(String(s.senhaAluno||s.code).trim()):null);
 await db.runTransaction(async tx=>{const [existing,old]=await Promise.all([tx.get(idx),tx.get(priv)]);if(existing.exists&&existing.data().studentId!==doc.id)fail(409,'Há CPFs duplicados. Corrija os cadastros antes de migrar.');
 tx.set(idx,{studentId:doc.id});if(cred&&!old.exists)tx.set(priv,{credential:cred});tx.update(doc.ref,{senhaAluno:F.delete(),portalCredential:F.delete(),se7AuthUid:studentUid(doc.id)});});
 return {...publicStudent(s),se7AuthUid:studentUid(doc.id)};
}
async function findStudent(db,cpf){const idx=await db.collection('se7CpfIndex').doc(cpfKey(cpf)).get();if(!idx.exists)fail(401,'CPF ou senha inválidos. Solicite ajuda à instituição.');const doc=await db.collection('students').doc(idx.data().studentId).get();if(!doc.exists||String(doc.data().cpf||'').replace(/\D/g,'')!==cpf)fail(401,'CPF ou senha inválidos.');return doc;}
async function loginStudent(auth,db,req,b){
 const cpf=String(b.cpf||'').replace(/\D/g,'');if(cpf.length!==11||typeof b.password!=='string'||b.password.length>128)fail(401,'CPF ou senha inválidos.');await limits(db,req,'login',cpfKey(cpf));
 const doc=await findStudent(db,cpf);const s=doc.data();if(s.portalBlocked||s.se7AuthLock)fail(401,'CPF ou senha inválidos. Contate a instituição.');
 if(s.portalMustChangePassword&&(!s.portalTemporaryExpiresAt||Date.parse(s.portalTemporaryExpiresAt)<Date.now()))fail(401,'CPF ou senha inválidos ou acesso temporário expirado.');
 const uid=studentUid(doc.id);let user;try{user=await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
 if(!user){const p=await db.collection('se7Credentials').doc(doc.id).get();if(!p.exists||!await verifyPassword(b.password,p.data().credential))fail(401,'CPF ou senha inválidos.');
  // Legacy codes shorter than Firebase's password minimum still receive a custom login once, then must change.
  const oldPass=b.password.length>=6?b.password:randomBytes(24).toString('hex');
  try{user=await auth.createUser({uid,email:alias(doc.id),password:oldPass,displayName:s.fullname||'Aluno'});}catch(e){if(e.code==='auth/uid-already-exists')fail(409,'Acesso em preparação. Tente novamente.');throw e;}
  await claims(auth,uid,{role:'aluno',studentId:doc.id,portalVersion:s.portalSessionVersion||0});
  await doc.ref.update({se7AuthUid:uid,senhaAluno:F.delete(),portalCredential:F.delete(),...(b.password.length<6?{portalMustChangePassword:true,portalTemporaryExpiresAt:new Date(Date.now()+86400000).toISOString()}: {})});
  await db.collection('se7Credentials').doc(doc.id).delete();
 }else {if(user.disabled||!await authPassword(alias(doc.id),b.password))fail(401,'CPF ou senha inválidos.');await claims(auth,uid,{role:'aluno',studentId:doc.id,portalVersion:s.portalSessionVersion||0});}
 const fresh=await doc.ref.get();if(fresh.data().portalBlocked||fresh.data().se7AuthLock)fail(403,'Acesso alterado. Tente novamente.');return {customToken:await auth.createCustomToken(uid,{role:'aluno',studentId:doc.id,portalVersion:fresh.data().portalSessionVersion||0})};
}
async function lockStudent(db,id){const ref=db.collection('students').doc(id);const lock=randomBytes(12).toString('hex');await db.runTransaction(async tx=>{const d=await tx.get(ref);if(!d.exists)fail(404,'Aluno não encontrado.');if(d.data().se7AuthLock)fail(409,'Outra operação de acesso está em andamento.');tx.update(ref,{se7AuthLock:lock});});return {ref,lock};}
async function unlock(ref,lock){await ref.firestore.runTransaction(async tx=>{const d=await tx.get(ref);if(d.exists&&d.data().se7AuthLock===lock)tx.update(ref,{se7AuthLock:F.delete()});});}
async function publicInfo(db){const snap=await db.collection('config').doc('institution').get();const d=snap.data()||{};const fields=['name','razao','cnpj','email','tel','end','loginDesc','logo','logomarca','urlLogo','logoUrl','image','fileUrl'];return {institution:Object.fromEntries(fields.filter(k=>typeof d[k]==='string').map(k=>[k,d[k]]))};}
async function dispatchOperation({auth,db},req,b){
 const action=b.action;
 if(action==='public-info')return publicInfo(db);
 if(action==='catalog'){const snap=await db.collection('courses').get();return {courses:snap.docs.map(d=>({id:d.id,name:d.data().name||'Curso'}))};}
 if(action==='student-login')return loginStudent(auth,db,req,b);
 if(action==='signup'){
  await limits(db,req,'signup');password(b.password);const data=b.student||{};if(!validCPF(data.cpf))fail(400,'CPF inválido.');for(const k of ['fullname','birthDate','gender','rg','whatsapp','cep','street','number','neighborhood','city','state','courseId'])if(typeof data[k]!=='string'||!data[k].trim()||data[k].length>200)fail(400,`Preencha ${k}.`);
  if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))fail(400,'E-mail inválido.');const course=await db.collection('courses').doc(validId(data.courseId)).get();if(!course.exists)fail(400,'Curso inválido.');
  for(const value of Object.values(data))if(typeof value==='string'&&(value.length>1000||/[<>]/.test(value)))fail(400,'Texto de cadastro inválido.');
  const fields=['fullname','birthDate','gender','cpf','rg','whatsapp','email','address','endereco','cep','street','number','neighborhood','city','state','courseId'];const s=Object.fromEntries(fields.filter(k=>typeof data[k]==='string').map(k=>[k,data[k].trim()]));s.cpf=s.cpf.replace(/\D/g,'');
  const ref=db.collection('students').doc();const uid=studentUid(ref.id),idx=db.collection('se7CpfIndex').doc(cpfKey(s.cpf));
  await db.runTransaction(async tx=>{const d=await tx.get(idx);if(d.exists)fail(409,'Já existe um cadastro com este CPF. Solicite ajuda à instituição.');tx.set(idx,{studentId:ref.id,pending:true});});
  try{await auth.createUser({uid,email:alias(ref.id),password:b.password,displayName:s.fullname});await claims(auth,uid,{role:'aluno',studentId:ref.id,portalVersion:0});
   const code=`MAT-${new Date().getFullYear()}-${ref.id.slice(-8).toUpperCase()}`;await ref.set({...s,code,dob:s.birthDate,classId:'',status:'Ativo',documentos:{},attendance:{},enrollmentDate:enrollmentToday(),enrollmentRegisteredAt:new Date().toISOString(),academicEntry:{version:1,state:'awaiting_class',startDate:'',notTaken:[],planned:[]},se7AuthUid:uid,portalSessionVersion:0,createdAt:new Date().toISOString()});await idx.set({studentId:ref.id});const customToken=await auth.createCustomToken(uid,{role:'aluno',studentId:ref.id,portalVersion:0});await enrollmentAsaas.markNew(db,ref.id);try{await setConsent(db,ref.id,data.whatsappOptIn===true,{uid,role:'aluno'});await enrollmentNotifications(db,ref.id,{uid,role:'aluno'});}catch{console.warn('SE7 WhatsApp: matrícula salva; notificação não concluída.');}return {customToken,student:{id:ref.id,...s,code}};
  }catch(e){await auth.deleteUser(uid).catch(()=>{});await ref.delete().catch(()=>{});await idx.delete();throw e;}
 }
 const u=await identity(auth,db,req);req.se7AuditIdentity=u;await limits(db,req,'gateway:'+u.uid);
 if(action==='audit-event'){
  if(!['master','secretaria','professor','financeiro','totem'].includes(u.role))fail(403,'Acesso restrito.');
  if(typeof b.acao!=='string'||!b.acao.trim()||b.acao.length>2000||typeof b.modulo!=='string'||!b.modulo.trim()||b.modulo.length>120)fail(400,'Registro de auditoria inválido.');
  await limits(db,req,'audit:'+u.uid);const now=new Date();await db.collection('systemLogs').add({dataHora:now.toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}),createdAt:now.toISOString(),usuario:u.profile?.nome||u.name||u.email||u.uid,perfil:u.role.toUpperCase(),modulo:b.modulo.trim(),acao:b.acao.trim(),actorUid:u.uid,origem:'atividade do navegador'});return {ok:true};
 }
 if(action==='academic-entry-plan')return academicIngress.refresh(db,validId(b.studentId),u);
 if(action.startsWith('enrollment-asaas-')){if(!['master','secretaria','financeiro'].includes(u.role))fail(403,'Acesso restrito.');if(action==='enrollment-asaas-list')return enrollmentAsaas.list(db,u);const id=validId(b.studentId);if(action==='enrollment-asaas-start')return enrollmentAsaas.start(db,id,u);if(action==='enrollment-asaas-step')return enrollmentAsaas.step(db,id,u);if(action==='enrollment-asaas-status')return enrollmentAsaas.status(db,id);if(action==='enrollment-asaas-retry')return enrollmentAsaas.retry(db,id,u);fail(400,'Operação inválida.');}
 if(action.startsWith('exam-')){if(['exam-save','exam-scan-preview','exam-scan-commit','exam-bind','exam-print'].includes(action))await limits(db,req,'asaas-bulk:exams:'+u.uid);return exams.dispatch(db,auth,b,u);}
 if(action==='portal-preview')return portalPreview(db,b,u);
 if(action.startsWith('notices-')){
  if(action==='notices-catalog')return notices.catalog(db,u);
  if(action==='notices-get')return notices.getNotice(db,b.id,u);
  if(action==='notices-save'){await limits(db,req,'notices-save:'+u.uid);return notices.save(db,b,u);}
  if(action==='notices-delete')return notices.remove(db,b,u);
  if(action==='notices-feed')return notices.feed(db,u);
  if(action==='notices-open')return notices.studentNotice(db,b,u);
  if(action==='notices-read')return notices.studentNotice(db,b,u,true);
  fail(400,'Operação de aviso desconhecida.');
 }
 if(action==='finance-batch-preview'||action==='finance-batch-commit'){await limits(db,req,'asaas-bulk:finance-batch:'+u.uid);return action==='finance-batch-preview'?financeBatch.preview(db,b,u):financeBatch.commit(db,b,u);}
 if(action.startsWith('email-')){
  if(u.role==='professor'&&['email-save-grade','email-save-attendance','email-grade','email-attendance','email-list','email-pending'].includes(action))fail(403,'Use o ambiente dedicado do professor.');
  if(action==='email-save-grade'){await limits(db,req,'asaas-bulk:email-save:'+u.uid);return mail.saveGradeWithEmail(db,b,u);}
  if(action==='email-save-attendance'){await limits(db,req,'asaas-bulk:email-save:'+u.uid);return mail.saveAttendanceWithEmail(db,b,u);}
  if(action==='email-enrollment')return mail.enrollmentEmail(db,b.studentId,u);
  if(action==='email-list')return mail.listEmails(db,u);
  if(action==='email-pending')return mail.pendingEmails(db,u);
  if(action==='email-config'){if(!['master','secretaria'].includes(u.role))fail(403,'Acesso restrito.');return mail.emailConfig();}
  if(action==='email-send'){await limits(db,req,'email-send:'+u.uid);return mail.sendEmail(db,b.id,u);}
  if(action==='email-attendance'){await limits(db,req,'asaas-bulk:email-events:'+u.uid);return mail.attendanceEmail(db,b.recordId,u);}
  if(action==='email-grade'){await limits(db,req,'asaas-bulk:email-events:'+u.uid);return mail.gradeEmail(db,b.studentId,b.subjectId,u);}
  if(action==='email-documents'){if(u.role!=='aluno')fail(403,'Acesso restrito ao aluno.');return mail.documentsEmail(db,u.studentId);}
  fail(400,'Operação de e-mail desconhecida.');
 }
 if(action==='enrollment-finance-local'){if(!['master','secretaria','financeiro','aluno'].includes(u.role))fail(403,'Acesso restrito.');const studentId=u.role==='aluno'?u.studentId:validId(b.studentId);await limits(db,req,'asaas-bulk:history:'+u.uid);const history=await asaas.syncPaidHistory(db,studentId,u);if(!history.safe)return {cancelled:0,warning:history.warning,paymentReview:history};return {...await reviewLocal(db,studentId,u),paymentReview:history};}
 if(action==='enrollment-finance-list'||action==='enrollment-finance-cancel'){if(!['master','secretaria','financeiro'].includes(u.role))fail(403,'Acesso restrito.');await limits(db,req,'asaas-bulk:'+u.uid);return action==='enrollment-finance-list'?asaas.cancellationInvoices(db,validId(b.studentId),u):asaas.cancelEnrollmentInvoice(db,validId(b.invoiceId),u);}
 if(typeof action==='string'&&action.startsWith('asaas-')){
  const finance=['master','financeiro'].includes(u.role);
  if(!finance&&u.role!=='aluno')fail(403,'Acesso restrito ao financeiro.');
  if(u.role==='aluno'&&u.student.portalMustChangePassword)fail(403,'Troque sua senha antes de consultar pagamentos.');
  if(action==='asaas-invoices')return asaas.invoices(db,u.role==='aluno'?u.studentId:validId(b.studentId));
  if(action==='asaas-payment')return asaas.paymentDetails(db,validId(b.invoiceId),u,b.mode);
  if(!finance)fail(403,'Aluno não pode emitir ou alterar cobranças.');
  if(action.startsWith('asaas-replacement-')){await limits(db,req,'asaas-bulk:replacement:'+u.uid);if(action==='asaas-replacement-candidates')return replacement.candidates(db,validId(b.invoiceId),u);if(action==='asaas-replacement-preview')return replacement.preview(db,b,u);if(action==='asaas-replacement-commit')return replacement.commit(db,b,u);fail(400,'Operação de substituição desconhecida.');}
  if(action==='asaas-config')return asaas.config();
  if(action==='asaas-bulk-preview'||action==='asaas-bulk-commit'||action==='asaas-bulk-sync'){
   await limits(db,req,'asaas-bulk:'+u.uid);
   if(action==='asaas-bulk-sync')return asaas.reconcile(db,validId(b.invoiceId));
   return action==='asaas-bulk-preview'?asaasBulk.preview(db,validId(b.studentId),u):asaasBulk.commitOne(db,b.planId,validId(b.invoiceId),u);
  }
  await limits(db,req,'asaas:'+u.uid);
  if(action==='asaas-check'){await asaas.api('/customers?limit=1');return {ok:true,environment:'production'};}
  if(action==='asaas-link-customer')return asaas.linkCustomer(db,validId(b.studentId),b.customerId||'',u);
  if(action==='asaas-candidates')return asaas.candidates(db,validId(b.invoiceId));
  if(action==='asaas-emit')return asaas.emit(db,validId(b.invoiceId),b.billingType,u);
  if(action==='asaas-import')return asaas.importPayment(db,validId(b.invoiceId),b.paymentId,u);
  if(action==='asaas-reconcile')return asaas.recover(db,validId(b.invoiceId));
  fail(400,'Operação Asaas desconhecida.');
 }
 if(action==='whatsapp-consent'){
  if(!['master','secretaria','aluno'].includes(u.role))fail(403,'Acesso restrito.');
  const id=u.role==='aluno'?u.studentId:validId(b.id);if(u.role==='aluno'&&b.id&&b.id!==id)fail(403,'Aluno inválido.');
  return setConsent(db,id,b.optIn,u);
 }
 if(action==='whatsapp-enrollment'||action==='whatsapp-exam'){
  if(!['master','secretaria'].includes(u.role))fail(403,'Acesso restrito.');await limits(db,req,'whatsapp:'+u.uid);
  return action==='whatsapp-enrollment'?enrollmentNotifications(db,validId(b.id),u):examNotification(db,validId(b.id),u);
 }
 if(['whatsapp-config','whatsapp-list','whatsapp-check','whatsapp-test','whatsapp-retry'].includes(action)){
  master(u);if(action==='whatsapp-config')return waConfig();if(action==='whatsapp-list')return listMessages(db);
  if(action==='whatsapp-check')return checkConnection();await limits(db,req,'whatsapp:'+u.uid);
  if(action==='whatsapp-test')return centralTest(db,u);return sendJob(db,validId(b.id));
 }
 if(action==='session'){
  if(u.role==='aluno')return {profile:{id:u.studentId,...publicStudent(u.student)},role:u.role};
  if(u.role==='master')await claims(auth,u.uid,{role:'master'});
  const account=await auth.getUser(u.uid);
  const storedName=account.displayName||u.profile?.nome||'';
  const nome=storedName&&!storedName.includes('@')?storedName:({master:'Master',secretaria:'Secretaria',professor:'Professor',financeiro:'Financeiro',totem:'Totem'}[u.role]||'Usuário');
  return {profile:{uid:u.uid,email:account.email||u.email,nome,perfil:u.role},role:u.role};
 }
 if(action==='profile-name'){
  if(!['master','secretaria','professor','financeiro','totem'].includes(u.role))fail(403,'Ação não permitida.');
  const name=typeof b.name==='string'?b.name.trim().replace(/\s+/g,' '):'';
  if(name.length<2||name.length>100||/[<>@\x00-\x1f]/.test(name))fail(400,'Informe um nome entre 2 e 100 caracteres.');
  await auth.updateUser(u.uid,{displayName:name});
  if(u.profile)await db.collection('se7Staff').doc(u.uid).update({nome:name});
  return {profile:{uid:u.uid,email:u.email,nome:name,perfil:u.role},role:u.role};
 }
 if(u.role==='aluno'){
  const ref=db.collection('students').doc(u.studentId);
  if(action==='change-password'){
   password(b.password);if(!u.student.portalMustChangePassword)fail(400,'A troca obrigatória não está pendente.');if(await authPassword(alias(u.studentId),b.password))fail(400,'Escolha uma senha diferente da temporária.');
   const {lock}=await lockStudent(db,u.studentId);
   try {await auth.updateUser(u.uid,{password:b.password});const v=(u.student.portalSessionVersion||0)+1;await claims(auth,u.uid,{role:'aluno',studentId:u.studentId,portalVersion:v});await auth.revokeRefreshTokens(u.uid);
    await ref.update({portalMustChangePassword:false,portalTemporaryExpiresAt:F.delete(),portalPasswordChangedAt:at(),portalSessionVersion:v});await ref.collection('portalAccessEvents').add({type:'password_changed',tab:null,at:at(),source:'app-aluno'});return {customToken:await auth.createCustomToken(u.uid,{role:'aluno',studentId:u.studentId,portalVersion:v})};
   }finally{await unlock(ref,lock);}
  }
  if(u.student.portalMustChangePassword)fail(403,'Defina uma nova senha para continuar.');
  if(action==='event'){
   if(!['login','resume','tab'].includes(b.type)||b.type==='tab'&&!tabs.includes(b.tab))fail(400,'Evento inválido.');
   await limits(db,req,'event:'+u.uid);const batch=db.batch();batch.set(ref.collection('portalAccessEvents').doc(),{type:b.type,tab:b.type==='tab'?b.tab:null,at:at(),source:'app-aluno'});const patch={portalLastAccessAt:at()};if(b.type==='login'){patch.portalLastLoginAt=at();patch.portalLoginCount=F.increment(1);}if(b.type==='tab')patch[`portalTabCounts.${b.tab}`]=F.increment(1);batch.update(ref,patch);await batch.commit();return {ok:true};
  }
  if(action==='qr'){
   await limits(db,req,'qr:'+u.uid);
   const token=randomBytes(24).toString('hex');
   return db.runTransaction(async tx=>{
    const doc=await tx.get(ref);const student=doc.data();
    if(!student||student.portalBlocked||student.portalMustChangePassword||student.se7AuthLock||student.se7AuthUid!==u.uid||(student.portalSessionVersion||0)!==(u.portalVersion||0))fail(403,'Acesso alterado. Entre novamente.');
    const serverTime=Date.now(),expiresAt=serverTime+30000;
    tx.set(db.collection('se7AttendanceQr').doc(u.uid),{studentId:u.studentId,authUid:u.uid,portalVersion:student.portalSessionVersion||0,tokenHash:digest(token),issuedAt:new Date(serverTime),expiresAt:new Date(expiresAt),used:false});
    if(Object.hasOwn(student,'qrAttendanceToken')||student.qrAttendanceVersion!==2)tx.update(ref,{qrAttendanceToken:F.delete(),qrAttendanceVersion:2});
    return {token,qr:'SE7:ATTENDANCE:2:'+token,serverTime,expiresAt,ttlSeconds:30};
   });
  }
  if(action==='documents'){
   if(u.student.documentos?.[b.type]?.status==='Aprovado')fail(400,'Documento já aprovado. Solicite ajuda à instituição.');
   if(!docTypes.includes(b.type)||typeof b.fileName!=='string'||!b.fileName.trim()||b.fileName.length>180||/[<>\x00-\x1f]/.test(b.fileName)||typeof b.url!=='string'||b.url.length>1000||b.url&&!/^https:\/\/(?:drive\.google\.com|docs\.google\.com)\//.test(b.url))fail(400,'Documento inválido.');
   const submissionId=randomBytes(16).toString('hex');
   await db.runTransaction(async tx=>{
    const current=await tx.get(ref);if(!current.exists)fail(404,'Aluno não encontrado.');
    const previous=current.data().documentos?.[b.type];
    if(previous?.status==='Aprovado')fail(400,'Documento já aprovado. Solicite ajuda à instituição.');
    const reviewHistory=Array.isArray(previous?.reviewHistory)?[...previous.reviewHistory]:[];
    if(!reviewHistory.length&&previous?.status==='Reprovado'&&previous.motivoReprovacao)reviewHistory.push({status:'Reprovado',motivo:previous.motivoReprovacao,reviewedAt:previous.reviewedAt||null,reviewedBy:previous.reviewedBy||{name:'Secretaria'},submissionId:previous.submissionId||'',legacy:true});
    tx.update(ref,{[`documentos.${b.type}`]:{status:'Pendente',fileName:b.fileName,driveUrl:b.url,submissionId,submittedAt:new Date().toISOString(),motivoReprovacao:'',reviewHistory}});
   });let emailJobs=[],emailWarning='';try{emailJobs=(await mail.documentsEmail(db,u.studentId)).jobs;}catch{emailWarning='Documento salvo. O aviso por e-mail precisa ser preparado novamente.';}return {ok:true,submissionId,emailJobs,emailWarning};
  }
  if(action==='student-config'){const d=(await db.collection('config').doc('institution').get()).data()||{};return {...await publicInfo(db),gdriveUrl:typeof d.gdriveUrl==='string'?d.gdriveUrl:''};}
  fail(403,'Operação não permitida.');
 }
 if(action==='prepare-student'){if(!['master','secretaria'].includes(u.role))fail(403,'Acesso restrito.');const d=await db.collection('students').doc(validId(b.id)).get();if(!d.exists)fail(404,'Aluno não encontrado.');await prepareStudent(db,d);if(b.newEnrollment===true&&d.createTime?.toMillis()>Date.now()-600000){await enrollmentAsaas.markNew(db,d.id);await academicIngress.stampNew(db,d.id);}return {ok:true};}
 if(action==='attendance'){
  if(!['totem','master'].includes(u.role))fail(403,'Acesso restrito ao Totem.');await limits(db,req,'attendance:'+u.uid);
  if(typeof b.qr!=='string'||!/^SE7:ATTENDANCE:2:[a-f0-9]{48}$/.test(b.qr))fail(400,'QR Code antigo ou inválido. Abra novamente a carteirinha no aplicativo atualizado.');
  const tokenHash=digest(b.qr.split(':')[3]);
  const matches=await db.collection('se7AttendanceQr').where('tokenHash','==',tokenHash).limit(2).get();
  if(matches.size!==1)fail(404,'QR Code substituído ou inválido. Aguarde o novo código na carteirinha.');
  const qrRef=matches.docs[0].ref;
  const attendanceResult=await db.runTransaction(async tx=>{
   const qrSnap=await tx.get(qrRef),q=qrSnap.data();const now=new Date();
   if(!q||q.tokenHash!==tokenHash)fail(400,'QR Code substituído. Aguarde o novo código.');
   if(!q.expiresAt||now.getTime()>=q.expiresAt.toMillis())fail(400,'QR Code expirado. Aguarde o novo código na carteirinha.');
   if(q.used)fail(409,'QR Code já utilizado. Aguarde o novo código na carteirinha.');
   const studentRef=db.collection('students').doc(validId(q.studentId));
   const studentSnap=await tx.get(studentRef),student=studentSnap.data();
   if(!student||student.se7AuthUid!==q.authUid||(student.portalSessionVersion||0)!==q.portalVersion||student.portalBlocked||student.portalMustChangePassword||student.se7AuthLock||!['Ativo','Ativa'].includes(student.status)||!student.classId)fail(403,'Aluno sem acesso ativo ou turma. Procure a secretaria.');
   const date=now.toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});if(student.enrollmentDate&&date<student.enrollmentDate||student.academicEntry?.startDate&&date<student.academicEntry.startDate)fail(409,'Presença anterior ao início acadêmico do aluno. Procure a secretaria.');
   const attendanceRef=db.collection('attendance').doc(`presenca_${studentRef.id}_${date}`);
   const existing=await tx.get(attendanceRef);
   const dayEvents=await tx.get(db.collection('academicCalendars').where('classId','==',student.classId));if(dayEvents.docs.some(d=>d.data().eventType==='holiday'&&d.data().dates?.includes(date)))fail(409,'Data registrada como feriado para esta turma. Não será registrada presença de aula.');if(student.enrollmentDate){const entry=planEntry({courseId:student.courseId,classId:student.classId,enrollmentDate:student.enrollmentDate,calendars:dayEvents.docs.map(d=>d.data())});if(!entry.startDate||date<entry.startDate)fail(409,'Aluno ainda não iniciou a primeira disciplina prevista. Procure a secretaria.');}
   tx.update(qrRef,{used:true,usedAt:at(),usedBy:u.uid});
   if(!existing.exists)tx.set(attendanceRef,{studentId:studentRef.id,nomeAluno:student.fullname||'Aluno',data:date,horario:now.toLocaleTimeString('pt-BR',{timeZone:'America/Fortaleza'}),status:'PRESENTE',registradoPor:'Totem QR dinâmico autenticado',actorUid:u.uid,createdAt:at()});
   return {name:student.fullname||'Aluno',repeated:existing.exists,emailStudentId:studentRef.id,emailDate:date,classId:student.classId};
  });let emailJobs=[];try{const subject=await mail.calendarSubject(db,attendanceResult.classId,attendanceResult.emailDate);const job=await mail.queuePresence(db,attendanceResult.emailStudentId,attendanceResult.emailDate,subject,'totem',u.uid);if(job)emailJobs=[job];}catch{console.warn('Presença salva; aviso de e-mail não preparado.');}return {name:attendanceResult.name,repeated:attendanceResult.repeated,emailJobs};
 }
 master(u);
 if(action==='health'){return {ok:true,project:PROJECT,uid:u.uid};}
 if(action==='migrate-students'){
  const limit=30;let query=db.collection('students').orderBy('__name__').limit(limit);if(b.after)query=query.startAfter(validId(b.after));const snap=await query.get();const results=[];
  for(const d of snap.docs){try{await prepareStudent(db,d);results.push({id:d.id,ok:true});}catch(e){results.push({id:d.id,ok:false,error:e.message});}}
  return {results,next:snap.size===limit?snap.docs.at(-1).id:null};
 }
 if(action==='reset-student'){
  const id=validId(b.id),ref=db.collection('students').doc(id);const doc=await ref.get();if(!doc.exists)fail(404,'Aluno não encontrado.');await prepareStudent(db,doc);
  const {lock}=await lockStudent(db,id);try{const fresh=(await ref.get()).data();const uid=studentUid(id),temporary=randomBytes(9).toString('hex');let user;try{user=await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
   if(user)await auth.updateUser(uid,{password:temporary});else await auth.createUser({uid,email:alias(id),password:temporary,displayName:fresh.fullname||'Aluno'});
   const v=(fresh.portalSessionVersion||0)+1;await claims(auth,uid,{role:'aluno',studentId:id,portalVersion:v});await auth.revokeRefreshTokens(uid);await ref.update({portalMustChangePassword:true,portalTemporaryExpiresAt:new Date(Date.now()+86400000).toISOString(),portalSessionVersion:v});await db.collection('se7Credentials').doc(id).delete();await audit(db,id,u,'Redefinição de acesso');return {temporary};
  }finally{await unlock(ref,lock);}
 }
 if(action==='block-student'){
  const id=validId(b.id),ref=db.collection('students').doc(id);if(typeof b.blocked!=='boolean')fail(400,'Situação inválida.');await ref.update({portalBlocked:b.blocked,portalSessionVersion:F.increment(1)});try{await auth.updateUser(studentUid(id),{disabled:b.blocked});await auth.revokeRefreshTokens(studentUid(id));}catch(e){if(e.code!=='auth/user-not-found')throw e;}await audit(db,id,u,b.blocked?'Acesso bloqueado':'Acesso liberado');return {ok:true};
 }
 if(action==='staff-list'){const snap=await db.collection('se7Staff').get();return {users:snap.docs.map(d=>({id:d.id,...d.data()}))};}
 if(action==='legacy-staff'){const snap=await db.collection('systemUsers').get();return {users:snap.docs.map(d=>({id:d.id,nome:d.data().nome||d.data().name||'',email:d.data().email||'',perfil:d.data().perfil||''}))};}
 if(action==='staff-create'){
  password(b.password);if(!roles.includes(b.role)||typeof b.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||/[<>\x00-\x1f]/.test(b.name))fail(400,'Informe nome, e-mail e um perfil permitido.');
  const email=b.email.trim().toLowerCase();let existing;try{existing=await auth.getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  if(existing)fail(409,'E-mail já cadastrado no Authentication. Use a função de vincular conta existente.');
  const user=await auth.createUser({email,password:b.password,displayName:b.name});await db.collection('se7Staff').doc(user.uid).set({nome:b.name,email,perfil:b.role,disabled:false});await claims(auth,user.uid,{role:b.role});return {uid:user.uid};
 }
 if(action==='staff-link'){
  const uid=validId(b.uid);if(uid===process.env.SE7_MASTER_UID)fail(400,'A conta master não pode ser alterada.');if(!roles.includes(b.role))fail(400,'Perfil inválido.');const user=await auth.getUser(uid);if(user.customClaims?.studentId||uid.startsWith('se7s_'))fail(400,'Conta de aluno não pode ser vinculada como funcionário.');await auth.updateUser(uid,{disabled:false});await db.collection('se7Staff').doc(uid).set({nome:user.displayName||user.email||'Funcionário',email:user.email||'',perfil:b.role,disabled:false});await claims(auth,uid,{role:b.role});return {ok:true};
 }
 if(action==='staff-disable'){
  const uid=validId(b.uid);if(uid===process.env.SE7_MASTER_UID)fail(400,'Não é permitido desativar o master.');const doc=await db.collection('se7Staff').doc(uid).get();if(!doc.exists)fail(404,'Funcionário não cadastrado.');await db.collection('se7Staff').doc(uid).update({disabled:true});await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);return {ok:true};
 }
 fail(400,'Operação desconhecida.');
}
const auditActionNames={'exam-catalog':'Consultou avaliações e dados do professor','exam-get':'Abriu uma avaliação para edição','exam-save':'Salvou avaliação','exam-roster':'Consultou alunos para impressão','exam-print':'Gerou prova nominal e cartão-resposta','exam-scan-start':'Identificou cartão-resposta para correção','exam-scan-preview':'Analisou foto do cartão-resposta','exam-scan-commit':'Registrou correção e notas da avaliação','exam-results':'Consultou correções','exam-result':'Consultou cartão corrigido','exam-point':'Consultou frequência e pagamentos','exam-bind':'Vinculou acesso do professor','exam-verify':'Validou QR de documento'};
export async function dispatch(services,req,b){
 delete req.se7AuditIdentity;
 const record=async(result,failed=false)=>{const u=req.se7AuditIdentity;if(b.action==='audit-event'||!u||!['master','secretaria','professor','financeiro','totem'].includes(u.role))return;const action=String(b.action||'').slice(0,100),details=[];for(const key of ['id','teacherId','classId','studentId','examId','planId','paymentId'])if(typeof b[key]==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(b[key]))details.push(key+': '+b[key]);if(action==='exam-save')details.push(b.state==='final'?'Finalizada':'Rascunho');if(result?.duplicate)details.push('Operação já registrada; sem duplicação');const now=new Date();try{await services.db.collection('systemLogs').add({dataHora:now.toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}),createdAt:now.toISOString(),usuario:u.profile?.nome||u.name||u.email||u.uid,perfil:u.role.toUpperCase(),modulo:action.startsWith('exam-')?'Gestão de Avaliações':action.startsWith('asaas-')?'Financeiro / Asaas':action.startsWith('email-')?'E-mails':action.startsWith('notices-')?'Avisos':action.startsWith('staff-')?'Acessos':'Sistema / '+action,acao:(failed?'Não concluído: ':'Concluído: ')+(auditActionNames[action]||action)+(details.length?' • '+details.join(' • '):''),actorUid:u.uid,origem:'servidor'});}catch{console.warn('SE7: não foi possível gravar o registro de auditoria.');}};
 try{const result=await dispatchOperation(services,req,b);await record(result);return result;}catch(error){await record(null,true);throw error;}
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try {
  if(req.method!=='POST')fail(405,'Use POST.');const origin=req.headers.origin;if(origin!=='https://sistema-escolar-ten-mu.vercel.app')fail(403,'Origem não autorizada.');
  if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Envie JSON.');let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{fail(400,'JSON inválido.');}if(!b||Array.isArray(b)||typeof b.action!=='string'||JSON.stringify(b).length>(b.action==='notices-save'||b.action==='exam-scan-preview'?750000:b.action==='exam-save'?250000:12000))fail(400,'Requisição inválida.');
  if(!process.env.SE7_MASTER_UID)throw new Error('Master não configurado.');const result=await dispatch(services(),req,b);res.status(200).json(result);
 }catch(e){const status=e.status||500;if(status===500)console.error('SE7 API',e.code||'internal');res.status(status).json({error:status===500?'Não foi possível concluir. Verifique a configuração do servidor.':e.message});}
}
