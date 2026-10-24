import {stepInternshipBilling,startInternshipBilling} from '../server/internship-billing.mjs';
import {verifyPreceptorContract} from '../server/preceptor-contracts.mjs';
import {studentTerms,verifyStudentTerm} from '../server/internship-student-terms.mjs';
import {studentTermFiles} from '../server/internship-student-term-files.mjs';
import {agreementFiles} from '../server/internship-agreement-files.mjs';
import {agreementTerm,verifyAgreementTerm} from '../server/internship-agreement-terms.mjs';
import {internshipAgreements} from '../server/internship-agreements.mjs';
import {schoolCensus} from '../server/school-census.mjs';
import {clearAudit} from '../server/audit-maintenance.mjs';
import {mutationAction,browserMutation} from '../assets/se7-audit-policy.js';
import {preceptorContracts,hasAuthorizedPreceptor} from '../server/preceptor-contracts.mjs';
import {internships} from '../server/internships.mjs';
import {preceptorPayment} from '../server/internship-payroll.mjs';
import {internshipDocuments} from '../server/internship-documents.mjs';
import {authorizeEnrollmentEmail} from '../server/email-dedup.mjs';
import {employmentPatch} from '../server/collaborator-lifecycle.mjs';
import {collaboratorDelete} from '../server/collaborator-delete.mjs';
import {installmentQuote,installmentPay,installmentStatus} from '../server/card-installments.mjs';
import {dispatch as renegotiations,consultationFailure} from '../server/renegotiations.mjs';
import {rejectAgreement} from '../server/agreements.mjs';
import {collaboratorDuplicates} from '../server/collaborator-duplicates.mjs';
import {collaboratorAccess} from '../server/collaborator-access.mjs';
import {saveCollaborator} from '../server/collaborators.mjs';
import {expenses} from '../server/expenses.mjs';
import {submitDocument,reviewDocument} from '../server/document-drive-review.mjs';
import {materials} from '../server/materials.mjs';
import {justification as attendanceJustification} from '../server/attendance-justification.mjs';
import {attendancePolo} from '../server/attendance-polo.mjs';
import {save as saveLessonRealization} from '../server/lesson-realization.mjs';
import * as portalAdmin from '../server/portal-admin.mjs';
import {cardPrepare,cardPay} from '../server/card-payment.mjs';
import {annualAction,verifyAnnual} from '../server/annual-statements.mjs';
import {issuePayrollReport,verifyPayrollReport} from '../server/payroll-report.mjs';
import {dispatchPayment} from '../server/payroll-payments.mjs';
import {dispatchReceipt} from '../server/payroll-receipt.mjs';
import {saveStudentAvatar} from '../server/student-avatar.mjs';
import {readProfile,saveProfile,staffProfile} from '../server/user-profile.mjs';
import * as eja from '../server/eja-workflow.mjs';
import {isEja,isSingleExam} from '../server/eja-policy.mjs';
import * as polos from '../server/polos.mjs';
import {scannerCors,nativeRequestAllowed} from '../server/scanner-access.mjs';
import * as documentAuthorizations from '../server/academic-document-authorizations.mjs';
import * as academicDocuments from '../server/academic-documents.mjs';
import * as diplomaIssuance from '../server/diploma-issuance.mjs';
import {saveCourse as saveCourseConfiguration} from '../server/course-configuration.mjs';
import {saveClass} from '../server/class-registration.mjs';
import * as academicIngress from '../server/academic-ingress.mjs';
import {today as enrollmentToday,planEntry,canAttend} from '../assets/se7-ingress-policy.js';
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
 const staff=await db.collection('se7Staff').doc(user.uid).get();if(staff.exists&&!staff.data().disabled){const profile=staff.data();if(profile.perfil!=='totem'){const linked=profile.teacherId?await db.collection('teachers').doc(validId(profile.teacherId)).get():null;if(!linked?.exists||linked.data().active===false||profile.accessAuthorized===false)fail(403,'Acesso não autorizado no cadastro do colaborador. Contate o Master.');if(profile.perfil==='master'&&profile.masterAccess!==true)fail(403,'Acesso Master não autorizado.');}return polos.activeAccess(db,{...user,role:profile.perfil,profile});}
 const preceptorAccount=await db.collection('se7PreceptorAccounts').doc(user.uid).get();if(preceptorAccount.exists){const a=preceptorAccount.data(),p=await db.collection('se7Preceptors').doc(validId(a.preceptorId)).get();if(a.mustChangePassword&&(!a.temporaryExpiresAt||Date.parse(a.temporaryExpiresAt)<Date.now()))fail(403,'Senha temporária expirada. Solicite uma nova à instituição.');if(!p.exists||!p.data().active||p.data().authUid!==user.uid||!await hasAuthorizedPreceptor(db,p.id))fail(403,'Acesso de preceptor inativo.');return {...user,role:'preceptor',preceptorId:a.preceptorId,mustChangePassword:!!a.mustChangePassword,profile:{nome:p.data().name,email:p.data().email}};}
 const sid=user.studentId;if(!sid)fail(403,'Conta sem permissão. Contate o master.');
 const doc=await db.collection('students').doc(validId(sid)).get();const s=doc.exists?doc.data():null;
 if(!s||s.se7AuthUid!==user.uid||s.portalBlocked||s.se7AuthLock||(s.portalSessionVersion||0)!==(user.portalVersion||0))fail(403,'Acesso alterado. Entre novamente ou contate a instituição.');
 if(s.portalMustChangePassword&&(!s.portalTemporaryExpiresAt||Date.parse(s.portalTemporaryExpiresAt)<Date.now()))fail(403,'Senha temporária expirada.');
 return polos.activeAccess(db,{...user,role:'aluno',studentId:sid,student:s});
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
 const fresh=await doc.ref.get();await polos.activeAccess(db,{role:'aluno',student:fresh.data()});if(fresh.data().portalBlocked||fresh.data().se7AuthLock)fail(403,'Acesso alterado. Tente novamente.');return {customToken:await auth.createCustomToken(uid,{role:'aluno',studentId:doc.id,portalVersion:fresh.data().portalSessionVersion||0})};
}
async function lockStudent(db,id){const ref=db.collection('students').doc(id);const lock=randomBytes(12).toString('hex');await db.runTransaction(async tx=>{const d=await tx.get(ref);if(!d.exists)fail(404,'Aluno não encontrado.');if(d.data().se7AuthLock)fail(409,'Outra operação de acesso está em andamento.');tx.update(ref,{se7AuthLock:lock});});return {ref,lock};}
async function unlock(ref,lock){await ref.firestore.runTransaction(async tx=>{const d=await tx.get(ref);if(d.exists&&d.data().se7AuthLock===lock)tx.update(ref,{se7AuthLock:F.delete()});});}
async function publicInfo(db){const snap=await db.collection('config').doc('institution').get();const d=snap.data()||{};const fields=['name','razao','cnpj','email','tel','end','loginDesc','logo','logomarca','urlLogo','logoUrl','image','fileUrl'];return {institution:Object.fromEntries(fields.filter(k=>typeof d[k]==='string').map(k=>[k,d[k]]))};}
async function dispatchOperation({auth,db},req,b,delegated=null){
 const action=b.action;
 if(action==='internship-preceptor-contract-verify'){academicDocuments.publicLimit(req);return verifyPreceptorContract(db,b);}
 if(action==='internship-student-term-verify'){academicDocuments.publicLimit(req);return verifyStudentTerm(db,b);}
 if(action==='internship-agreement-term-verify'){academicDocuments.publicLimit(req);return verifyAgreementTerm(db,b);}
 if(action==='annual-verify'){academicDocuments.publicLimit(req);return verifyAnnual(db,b.token);}
 if(action==='payroll-report-verify'){academicDocuments.publicLimit(req);return verifyPayrollReport(db,b);}
 if(action==='financial-agreement-verify'){academicDocuments.publicLimit(req);const {verify}=await import('../server/financial-document-validation.mjs');return verify(db,b);}
 if(action==='academic-document-verify'){academicDocuments.publicLimit(req);return academicDocuments.verify(db,b);}
 if(action==='public-info')return publicInfo(db);
 if(action==='catalog'){const [snap,ps]=await Promise.all([db.collection('courses').get(),db.collection('polos').where('active','==',true).get()]);return {ejaConditions:await eja.publicConditions(db),courses:snap.docs.map(d=>({id:d.id,name:d.data().name||'Curso',isEja:isSingleExam(d.data())})),polos:ps.docs.map(d=>({id:d.id,name:d.data().name,city:d.data().city,state:d.data().state}))};}
 if(action==='student-login')return loginStudent(auth,db,req,b);
 if(action==='signup'){
  await limits(db,req,'signup');password(b.password);const data=b.student||{};if(!validCPF(data.cpf))fail(400,'CPF inválido.');for(const k of ['fullname','birthDate','gender','rg','whatsapp','cep','street','number','neighborhood','city','state','courseId'])if(typeof data[k]!=='string'||!data[k].trim()||data[k].length>200)fail(400,`Preencha ${k}.`);
  if(typeof data.nacionalidade!=='string'||!data.nacionalidade.trim()||data.nacionalidade.length>100)fail(400,'Informe uma nacionalidade válida.');if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))fail(400,'E-mail inválido.');const polo=await polos.requirePolo(db,data.poloId);const course=await db.collection('courses').doc(validId(data.courseId)).get();if(!course.exists)fail(400,'Curso inválido.');const ejaContract=await eja.prepareEnrollment(db,course.data(),data);
  for(const value of Object.values(data))if(typeof value==='string'&&(value.length>1000||/[<>]/.test(value)))fail(400,'Texto de cadastro inválido.');
  const fields=['fullname','birthDate','gender','nacionalidade','cpf','rg','whatsapp','email','address','endereco','cep','street','number','neighborhood','city','state','courseId'];const s=Object.fromEntries(fields.filter(k=>typeof data[k]==='string').map(k=>[k,data[k].trim()]));s.cpf=s.cpf.replace(/\D/g,'');
  const ref=db.collection('students').doc();const uid=studentUid(ref.id),idx=db.collection('se7CpfIndex').doc(cpfKey(s.cpf));
  await db.runTransaction(async tx=>{const d=await tx.get(idx);if(d.exists)fail(409,'Já existe um cadastro com este CPF. Solicite ajuda à instituição.');tx.set(idx,{studentId:ref.id,pending:true});});
  try{await auth.createUser({uid,email:alias(ref.id),password:b.password,displayName:s.fullname});await claims(auth,uid,{role:'aluno',studentId:ref.id,portalVersion:0});
   const code=`MAT-${new Date().getFullYear()}-${ref.id.slice(-8).toUpperCase()}`;await ref.set({...s,poloId:polo.id,poloName:polo.name,code,dob:s.birthDate,classId:'',status:'Ativo',documentos:{},attendance:{},enrollmentDate:enrollmentToday(),enrollmentRegisteredAt:new Date().toISOString(),academicEntry:{version:1,state:'awaiting_class',startDate:'',notTaken:[],planned:[]},se7AuthUid:uid,portalSessionVersion:0,createdAt:new Date().toISOString()});await idx.set({studentId:ref.id});await authorizeEnrollmentEmail(db,ref.id);const customToken=await auth.createCustomToken(uid,{role:'aluno',studentId:ref.id,portalVersion:0});if(ejaContract)await eja.initialize(db,ref.id,{...s,poloId:polo.id},ejaContract);if(!ejaContract)await enrollmentAsaas.markNew(db,ref.id);try{await setConsent(db,ref.id,data.whatsappOptIn===true,{uid,role:'aluno'});await enrollmentNotifications(db,ref.id,{uid,role:'aluno'});}catch{console.warn('SE7 WhatsApp: matrícula salva; notificação não concluída.');}return {customToken,ejaEnabled:!!ejaContract,student:{id:ref.id,...s,code}};
  }catch(e){await auth.deleteUser(uid).catch(()=>{});await ref.delete().catch(()=>{});await db.collection('se7EjaContracts').doc(ref.id).delete().catch(()=>{});await idx.delete();throw e;}
 }
 const u=delegated||await identity(auth,db,req);req.se7AuditIdentity=u;if(u.role==='preceptor'&&action!=='session'&&!action.startsWith('internship-'))fail(403,'Acesso exclusivo ao ambiente de estágio.');await limits(db,req,'gateway:'+u.uid);
 if(action==='portal-admin'){
  if(b.operation==='open')return portalAdmin.openAccess(db,b,u);
  if(b.operation==='close')return portalAdmin.closeAccess(db,b,u);
  const ctx=await portalAdmin.accessContext(db,b,u);req.se7PortalAdmin={studentId:ctx.id,accessId:b.accessId,action:b.operation==='read'?'Consulta '+b.collection:b.operation==='bootstrap'?'Atualizou dados do portal':b.callAction};
  if(b.operation==='bootstrap')return portalAdmin.bootstrap(db,ctx);
  if(b.operation==='read')return portalAdmin.readPortal(db,b,ctx);
  if(b.operation!=='call')fail(400,'Operação inválida.');const inner=portalAdmin.allowedCall(ctx,b);
  try{return await dispatchOperation({auth,db},{...req,headers:req.headers,socket:req.socket},inner,ctx.user);}finally{req.se7AuditIdentity=u;}
 }
 if(['staff-profile-get','staff-profile-save'].includes(action))return staffProfile(db,auth,b,u);
 if(action.startsWith('collaborator-duplicates-'))return collaboratorDuplicates(db,b,u);
 if(action.startsWith('collaborator-access-'))return collaboratorAccess(db,auth,b,u);
 if(action==='collaborator-state'){master(u);const id=validId(b.id),ref=db.collection('teachers').doc(id);if(typeof b.active!=='boolean')fail(400,'Situação inválida.');const accounts=await db.collection('se7Staff').where('teacherId','==',id).get();if(accounts.docs.some(d=>d.id===u.uid||d.id===process.env.SE7_MASTER_UID))fail(400,'Não é permitido bloquear o Master.');await db.runTransaction(async tx=>{const t=await tx.get(ref);const entries=await Promise.all(accounts.docs.map(d=>tx.get(db.collection('se7Staff').doc(d.id))));if(!t.exists||t.data().deletedAt)fail(404,'Colaborador não encontrado.');tx.update(ref,{active:b.active,...employmentPatch(t.data(),b.active)});entries.forEach((s,i)=>{const a=s.data();tx.update(db.collection('se7Staff').doc(accounts.docs[i].id),{disabled:!b.active||a.accessAuthorized===false||a.disabled&&!a.disabledByCollaborator,disabledByCollaborator:!b.active&&a.accessAuthorized!==false});});});for(const d of accounts.docs){const s=await db.collection('se7Staff').doc(d.id).get();await auth.updateUser(d.id,{disabled:s.data().disabled});await auth.revokeRefreshTokens(d.id);}return {ok:true};}
 if(['collaborator-delete-preview','collaborator-delete'].includes(action))return collaboratorDelete(db,auth,b,u);
 if(action==='collaborator-remuneration-get'){master(u);const id=validId(b.id),[t,r,plans]=await Promise.all([db.collection('teachers').doc(id).get(),db.collection('teacherPaymentRates').doc(id).get(),db.collection('se7ExpensePlans').where('employeeId','==',id).get()]);if(!t.exists||t.data().deletedAt)fail(404,'Colaborador não encontrado.');const legacy=r.data()?.valorHora??t.data().valorHora??t.data().valorHoraAula??0;return {history:t.data().compensationHistory||[],legacyHourly:legacy,legacySalary:plans.docs.filter(d=>!d.data().deletedAt).map(d=>({amountCents:d.data().amountCents,dueDay:d.data().dueDay}))[0]||null};}
 if(action==='collaborator-save')return saveCollaborator(db,b,u,{auth});
 if(action.startsWith('renegotiation-')){await limits(db,req,'asaas-bulk:renegotiation:'+u.uid);return renegotiations(db,b,u);}
 if(action==='agreement-reject')return rejectAgreement(db,b,u);
 if(['internship-student-term-file-get','internship-student-term-file-upload'].includes(action))return studentTermFiles(db,b,u);
 if(action==='internship-student-term-billing-step')return stepInternshipBilling(db,b.cycleId,u);
 if(action==='internship-student-term-billing-start')return startInternshipBilling(db,b.id,u);
 if(action.startsWith('internship-student-term-'))return studentTerms(db,b,u);
 if(['internship-agreement-file-upload','internship-agreement-file-get'].includes(action))return agreementFiles(db,b,u);
 if(['internship-agreement-term-preview','internship-agreement-term-issue','internship-agreement-term-history'].includes(action))return agreementTerm(db,b,u);
 if(action.startsWith('internship-agreement-'))return internshipAgreements(db,b,u);
 if(action.startsWith('internship-contract-')||action.startsWith('internship-preceptor-document-'))return preceptorContracts(db,b,u);
 if(action.startsWith('internship-payroll-'))return preceptorPayment(db,b,u);
 if(action.startsWith('internship-document-'))return internshipDocuments(db,b,u);
 if(action.startsWith('internship-'))return internships(db,b,u,{auth});
 if(action.startsWith('expenses-'))return expenses(db,b,u);
 if(action==='documents-review')return reviewDocument(db,b,u);
 if(action==='documents-submit'){if(!['master','secretaria'].includes(u.role))fail(403,'Acesso restrito.');return submitDocument(db,b,u);}
 if(action.startsWith('materials-'))return materials(db,b,u);
 if(action==='annual-statements')return annualAction(db,b,u);
 if(action==='payroll-report-issue')return issuePayrollReport(db,b,u);
 if(['payroll-save','payroll-reverse'].includes(action))return dispatchPayment(db,b,u);
 if(action.startsWith('payroll-receipt-'))return dispatchReceipt(db,b,u);
 if(action==='student-avatar-save')return saveStudentAvatar(db,b,u);
 if(action.startsWith('eja-'))return eja.dispatch(db,b,u);
 if(['attendance-justification-save','attendance-justification-get','attendance-justification-list','attendance-justification-decide'].includes(action))return attendanceJustification(polos.scopedDatabase(db,u),b,u);
 if(action==='lesson-realization-save')return saveLessonRealization(db,b,u);
 if(action.startsWith('census-'))return schoolCensus(db,b,u);
 if(action==='audit-clear')return clearAudit(db,b,u);
 if(action==='polo-catalog')return polos.catalog(db,u);
 if(action==='polo-state')return polos.setActive(db,b,u);
 if(action==='polo-save')return polos.save(db,b,u);
 if(action==='polo-bind')return polos.bind(db,b,u);
 if(action==='polo-student')return polos.assignStudent(db,b,u);
 if(!['session','profile-name','profile-save','audit-event'].includes(action))db=polos.scopedDatabase(db,u);

 if(action==='audit-event'){
  if(!['master','secretaria','professor','financeiro','totem'].includes(u.role))fail(403,'Acesso restrito.');
  if(typeof b.acao!=='string'||!b.acao.trim()||b.acao.length>2000||typeof b.modulo!=='string'||!b.modulo.trim()||b.modulo.length>120)fail(400,'Registro de auditoria inválido.');
  if(!browserMutation(b.acao))return {ok:true,ignored:true};
  await limits(db,req,'audit:'+u.uid);const now=new Date();await db.collection('systemLogs').add({dataHora:now.toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}),createdAt:now.toISOString(),usuario:u.profile?.nome||u.name||u.email||u.uid,perfil:u.role.toUpperCase(),modulo:b.modulo.trim(),acao:b.acao.trim(),actorUid:u.uid,origem:'atividade do navegador'});return {ok:true};
 }
 if(action==='transfer-authorization-request')return documentAuthorizations.request(db,b,u);
 if(action==='transfer-authorization-list')return documentAuthorizations.list(db,b,u);
 if(action==='transfer-authorization-decide')return documentAuthorizations.decide(db,b,u);
 if(action==='academic-financial-statement')return academicDocuments.financialStatement(db,b,u);
 if(action==='diploma-check')return diplomaIssuance.check(db,b,u);
 if(action==='diploma-draft-save')return diplomaIssuance.saveDraft(db,b,u);
 if(action==='diploma-authorize')return diplomaIssuance.authorize(db,b,u,auth,authPassword);
 if(action==='diploma-print-record')return diplomaIssuance.recordPrint(db,b,u);
 if(action==='financial-agreement-document-issue'){const {issue}=await import('../server/financial-document-validation.mjs');return issue(db,b,u);}
 if(action==='academic-document-issue')return academicDocuments.issue(db,b,u);
 if(action==='academic-document-revoke')return academicDocuments.revoke(db,b,u);
 if(action==='course-save')return saveCourseConfiguration(db,b,u);
 if(action==='class-save')return saveClass(db,{...b,id:b.id?validId(b.id):undefined,courseId:validId(b.courseId)},u);
 if(action==='academic-entry-migrate')return academicIngress.migrate(db,(Array.isArray(b.studentIds)?b.studentIds:[]).map(validId),u);
 if(action==='academic-entry-plan')return academicIngress.refresh(db,validId(b.studentId),u,b.enrollmentDate);
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
  if(action==='email-delete-grade'){await limits(db,req,'asaas-bulk:email-save:'+u.uid);return mail.deleteGrade(db,b,u);}
  if(action==='email-save-grade'){const st=await db.collection('students').doc(validId(b.studentId)).get(),t=await db.collection('teachers').doc(validId(b.teacherId)).get();if(!st.exists||!st.data().poloId||!t.exists||!(t.data().poloIds||[]).includes(st.data().poloId))fail(403,'Confira o polo do aluno e o vínculo do professor ao polo.');await limits(db,req,'asaas-bulk:email-save:'+u.uid);return mail.saveGradeWithEmail(db,b,u);}
  if(action==='email-save-attendance'){const poloId=await attendancePolo(db,b,u);b={...b,poloId};await limits(db,req,'asaas-bulk:email-save:'+u.uid);return mail.saveAttendanceWithEmail(db,b,u);}
  if(action==='email-enrollment-status')return mail.enrollmentStatus(db,validId(b.studentId),u);
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
  if(action.startsWith('asaas-card-installment-')){await limits(db,req,'card:'+u.uid);if(action==='asaas-card-installment-quote')return installmentQuote(db,b,u);if(action==='asaas-card-installment-pay')return installmentPay(db,b,u,req);if(action==='asaas-card-installment-status')return installmentStatus(db,b,u);fail(400,'Operação inválida.');}
  if(action==='asaas-card-prepare'||action==='asaas-card-pay'){await limits(db,req,'card:'+u.uid);return action==='asaas-card-prepare'?cardPrepare(db,b,u):cardPay(db,b,u,req);}
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
 if(action==='profile-save')return saveProfile(db,auth,b,u);
 if(action==='session'){
  if(u.role==='preceptor')return {role:u.role,profile:{...u.profile,uid:u.uid,preceptorId:u.preceptorId,mustChangePassword:u.mustChangePassword}};
  if(u.role==='aluno')return {profile:{id:u.studentId,...publicStudent(u.student)},role:u.role};
  if(u.role==='master')await claims(auth,u.uid,{role:'master'});
  const account=await auth.getUser(u.uid);
  const ownProfile=await readProfile(db,u.uid);
  const storedName=account.displayName||u.profile?.nome||'';
  const nome=storedName&&!storedName.includes('@')?storedName:({master:'Master',secretaria:'Secretaria',professor:'Professor',financeiro:'Financeiro',totem:'Totem'}[u.role]||'Usuário');
  return {profile:{...ownProfile,uid:u.uid,email:account.email||u.email,nome,perfil:u.role,poloId:u.profile?.poloId||'',poloIds:u.profile?.poloIds||[]},role:u.role};
 }
 if(action==='profile-name'){
  if(!['master','secretaria','professor','financeiro','totem'].includes(u.role))fail(403,'Ação não permitida.');
  const name=typeof b.name==='string'?b.name.trim().replace(/\s+/g,' '):'';
  if(name.length<2||name.length>100||/[<>@\x00-\x1f]/.test(name))fail(400,'Informe um nome entre 2 e 100 caracteres.');
  await auth.updateUser(u.uid,{displayName:name});
  if(u.profile)await db.collection('se7Staff').doc(u.uid).update({nome:name});
  return {profile:{uid:u.uid,email:u.email,nome:name,perfil:u.role,poloId:u.profile?.poloId||'',poloIds:u.profile?.poloIds||[]},role:u.role};
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
   if(u.adminActor){await ref.collection('portalAccessEvents').add({type:'admin_'+String(b.type||'').slice(0,20),tab:b.tab||null,at:at(),source:'app-aluno-admin',actorUid:u.adminActor.uid,actorName:u.adminActor.name});return {ok:true};}
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
   const result=await submitDocument(db,b,u);let emailJobs=[],emailWarning='';try{emailJobs=(await mail.documentsEmail(db,u.studentId)).jobs;}catch{emailWarning='Documento salvo. O aviso por e-mail precisa ser preparado novamente.';}return {...result,emailJobs,emailWarning};
  }
  if(action==='student-config'){const d=(await db.collection('config').doc('institution').get()).data()||{};return {...await publicInfo(db),gdriveUrl:typeof d.gdriveUrl==='string'?d.gdriveUrl:''};}
  fail(403,'Operação não permitida.');
 }
 if(action==='prepare-student'){if(!['master','secretaria'].includes(u.role))fail(403,'Acesso restrito.');const d=await db.collection('students').doc(validId(b.id)).get();if(!d.exists)fail(404,'Aluno não encontrado.');await prepareStudent(db,d);if(b.newEnrollment===true&&d.createTime?.toDate().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'})===enrollmentToday()&&!d.data().enrollmentRegisteredAt){const c=await db.collection('courses').doc(d.data().courseId).get(),contract=await eja.prepareEnrollment(db,c.data(),{ejaPaymentMode:b.ejaChoice?.paymentMode,ejaCardInstallments:b.ejaChoice?.cardInstallments,ejaPricingRevision:b.ejaChoice?.pricingRevision});if(contract)await eja.initialize(db,d.id,d.data(),contract);else await enrollmentAsaas.markNew(db,d.id);if(d.data().enrollmentDate){await academicIngress.refresh(db,d.id,u);await d.ref.update({enrollmentRegisteredAt:new Date().toISOString()});}else await academicIngress.stampNew(db,d.id);await authorizeEnrollmentEmail(db,d.id);}return {ok:true};}
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
   const date=now.toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});if(student.enrollmentDate&&date<student.enrollmentDate)fail(409,'Presença anterior ao início acadêmico do aluno. Procure a secretaria.');
   const attendanceRef=db.collection('attendance').doc(`presenca_${studentRef.id}_${date}`);
   const existing=await tx.get(attendanceRef);
   const dayEvents=await tx.get(db.collection('academicCalendars').where('classId','==',student.classId));if(dayEvents.docs.some(d=>d.data().eventType==='holiday'&&d.data().dates?.includes(date)))fail(409,'Data registrada como feriado para esta turma. Não será registrada presença de aula.');if(student.enrollmentDate){const entry=planEntry({courseId:student.courseId,classId:student.classId,enrollmentDate:student.enrollmentDate,calendars:dayEvents.docs.map(d=>d.data())});if(!canAttend(student,date,dayEvents.docs.map(d=>d.data())))fail(409,'Aluno ainda não iniciou a primeira disciplina prevista. Procure a secretaria.');}
   tx.update(qrRef,{used:true,usedAt:at(),usedBy:u.uid});
   if(!existing.exists)tx.set(attendanceRef,{studentId:studentRef.id,nomeAluno:student.fullname||'Aluno',data:date,horario:now.toLocaleTimeString('pt-BR',{timeZone:'America/Fortaleza'}),status:'PRESENTE',registradoPor:'Totem QR dinâmico autenticado',actorUid:u.uid,createdAt:at()});
   return {name:student.fullname||'Aluno',repeated:existing.exists,emailStudentId:studentRef.id,emailDate:date,classId:student.classId};
  });let emailJobs=[];try{const subject=await mail.calendarSubject(db,attendanceResult.classId,attendanceResult.emailDate);const job=await mail.queuePresence(db,attendanceResult.emailStudentId,attendanceResult.emailDate,subject,'totem',u.uid);if(job)emailJobs=[job];}catch{console.warn('Presença salva; aviso de e-mail não preparado.');}return {name:attendanceResult.name,repeated:attendanceResult.repeated,emailJobs};
 }
 if(action==='reset-student'){
  if(!['master','secretaria'].includes(u.role))fail(403,'Apenas o master e a secretaria podem gerar senha temporária.');
  const id=validId(b.id),ref=db.collection('students').doc(id);const doc=await ref.get();if(!doc.exists)fail(404,'Aluno não encontrado.');polos.assertStudent(u,doc.data());await prepareStudent(db,doc);
  const {lock}=await lockStudent(db,id);try{const fresh=(await ref.get()).data();const uid=studentUid(id),temporary=randomBytes(9).toString('hex');let user;try{user=await auth.getUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
   if(user)await auth.updateUser(uid,{password:temporary});else await auth.createUser({uid,email:alias(id),password:temporary,displayName:fresh.fullname||'Aluno'});
   const v=(fresh.portalSessionVersion||0)+1;await claims(auth,uid,{role:'aluno',studentId:id,portalVersion:v});await auth.revokeRefreshTokens(uid);await ref.update({portalMustChangePassword:true,portalTemporaryExpiresAt:new Date(Date.now()+86400000).toISOString(),portalSessionVersion:v});await db.collection('se7Credentials').doc(id).delete();await audit(db,id,u,'Redefinição de acesso');return {temporary};
  }finally{await unlock(ref,lock);}
 }
 master(u);
 if(action==='health'){return {ok:true,project:PROJECT,uid:u.uid};}
 if(action==='migrate-students'){
  const limit=30;let query=db.collection('students').orderBy('__name__').limit(limit);if(b.after)query=query.startAfter(validId(b.after));const snap=await query.get();const results=[];
  for(const d of snap.docs){try{await prepareStudent(db,d);results.push({id:d.id,ok:true});}catch(e){results.push({id:d.id,ok:false,error:e.message});}}
  return {results,next:snap.size===limit?snap.docs.at(-1).id:null};
 }
 if(action==='block-student'){
  const id=validId(b.id),ref=db.collection('students').doc(id);if(typeof b.blocked!=='boolean')fail(400,'Situação inválida.');await ref.update({portalBlocked:b.blocked,portalSessionVersion:F.increment(1)});try{await auth.updateUser(studentUid(id),{disabled:b.blocked});await auth.revokeRefreshTokens(studentUid(id));}catch(e){if(e.code!=='auth/user-not-found')throw e;}await audit(db,id,u,b.blocked?'Acesso bloqueado':'Acesso liberado');return {ok:true};
 }
 if(action==='staff-list'){const snap=await db.collection('se7Staff').get();return {users:snap.docs.map(d=>({id:d.id,...d.data()}))};}
 if(action==='legacy-staff'){const snap=await db.collection('systemUsers').get();return {users:snap.docs.map(d=>({id:d.id,nome:d.data().nome||d.data().name||'',email:d.data().email||'',perfil:d.data().perfil||''}))};}
 if(action==='staff-create'){
  password(b.password);if(!roles.includes(b.role)||typeof b.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||/[<>\x00-\x1f]/.test(b.name))fail(400,'Informe nome, e-mail e um perfil permitido.');
  if(b.role==='secretaria')await polos.requirePolo(db,b.poloId);const email=b.email.trim().toLowerCase();let existing;try{existing=await auth.getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  if(existing)fail(409,'E-mail já cadastrado no Authentication. Use a função de vincular conta existente.');
  const user=await auth.createUser({email,password:b.password,displayName:b.name});await db.collection('se7Staff').doc(user.uid).set({nome:b.name,email,perfil:b.role,disabled:false,...(b.role==='secretaria'?{poloId:b.poloId,poloIds:[b.poloId]}:{})});await claims(auth,user.uid,{role:b.role});return {uid:user.uid};
 }
 if(action==='staff-link'){
  const uid=validId(b.uid);if(uid===process.env.SE7_MASTER_UID)fail(400,'A conta master não pode ser alterada.');if(!roles.includes(b.role))fail(400,'Perfil inválido.');if(b.role==='secretaria')await polos.requirePolo(db,b.poloId);const user=await auth.getUser(uid);if(user.customClaims?.studentId||uid.startsWith('se7s_'))fail(400,'Conta de aluno não pode ser vinculada como funcionário.');await auth.updateUser(uid,{disabled:false});await db.collection('se7Staff').doc(uid).set({nome:user.displayName||user.email||'Funcionário',email:user.email||'',perfil:b.role,disabled:false,...(b.role==='secretaria'?{poloId:b.poloId,poloIds:[b.poloId]}:{})},{merge:true});await claims(auth,uid,{role:b.role});return {ok:true};
 }
 if(action==='staff-disable'){
  const uid=validId(b.uid);if(uid===process.env.SE7_MASTER_UID)fail(400,'Não é permitido desativar o master.');const doc=await db.collection('se7Staff').doc(uid).get();if(!doc.exists)fail(404,'Funcionário não cadastrado.');await db.collection('se7Staff').doc(uid).update({disabled:true});await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);return {ok:true};
 }
 fail(400,'Operação desconhecida.');
}
const auditActionNames={'renegotiation-begin':'Confirmou renegociação de mensalidades','renegotiation-step':'Processou substituição de cobranças de renegociação','renegotiation-quote':'Consultou condições de renegociação','agreement-reject':'Reprovou proposta de acordo — aluno não aceitou','lesson-realization-save':'Alterou a data de realização de uma aula','census-save':'Salvou acompanhamento do Censo Escolar','audit-clear':'Limpou registros da auditoria','collaborator-save':'Atualizou cadastro do colaborador','collaborator-state':'Alterou situação do colaborador','polo-save':'Salvou cadastro de polo','polo-bind':'Atualizou vínculo de acesso aos polos','polo-student':'Alterou o polo do aluno','exam-scan-review':'Conferiu marcações duvidosas e calculou notas','exam-scan-status':'Consultou confirmação do lançamento de notas','transfer-authorization-request':'Solicitou autorização para emitir guia de transferência','transfer-authorization-decide':'Analisou autorização de transferência','academic-document-issue':'Emitiu documento pela Secretaria Acadêmica','academic-document-revoke':'Revogou documento acadêmico','diploma-draft-save':'Salvou escrituração institucional do diploma','diploma-authorize':'Autorizou emissão do diploma com senha Master','diploma-print-record':'Registrou emissão do diploma','exam-catalog':'Consultou avaliações e dados do professor','exam-get':'Abriu uma avaliação para edição','exam-save':'Salvou avaliação','exam-roster':'Consultou alunos para impressão','exam-print':'Gerou prova nominal e cartão-resposta','exam-scan-start':'Identificou cartão-resposta para correção','exam-scan-preview':'Analisou foto do cartão-resposta','exam-scan-commit':'Registrou correção e notas da avaliação','exam-results':'Consultou correções','exam-result':'Consultou cartão corrigido','exam-point':'Consultou frequência e pagamentos','exam-bind':'Vinculou acesso do professor','exam-verify':'Validou QR de documento'};
export async function dispatch(services,req,b){
 delete req.se7AuditIdentity;delete req.se7PortalAdmin;
 const record=async(result,failed=false)=>{const u=req.se7AuditIdentity;if(failed||b.action==='audit-clear'&&result?.more||!mutationAction(b.action,b)||result?.duplicate||['audit-event','transfer-authorization-list'].includes(b.action)||!u||!['master','secretaria','professor','financeiro','totem','preceptor'].includes(u.role))return;const action=String(b.action||'').slice(0,100),details=[];for(const key of ['id','uid','poloId','teacherId','classId','studentId','examId','planId','paymentId'])if(typeof b[key]==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(b[key]))details.push(key+': '+b[key]);if(action==='portal-admin'){const a=req.se7PortalAdmin;details.push('Acesso administrativo ao portal', 'Operação: '+(a?.action||b.operation||''));if(a)details.push('Aluno: '+a.studentId);if(b.operation==='open'&&b.studentId)details.push('Aluno: '+b.studentId);if(b.operation==='close'&&result?.studentId)details.push('Aluno: '+result.studentId);for(const k of ['type','id','tab','date','term'])if(typeof b.payload?.[k]==='string'||typeof b.payload?.[k]==='number')details.push(k+': '+String(b.payload[k]).replace(/[\x00-\x1f<>]/g,'').slice(0,120));}if(result?.id&&!b.id)details.push('id: '+String(result.id).slice(0,150));if(action==='audit-clear')details.push('Registros removidos neste lote: '+result.removed);if(action==='exam-save')details.push(b.state==='final'?'Finalizada':'Rascunho');if(result?.duplicate)details.push('Operação já registrada; sem duplicação');const now=new Date();try{await services.db.collection('systemLogs').add({dataHora:now.toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}),createdAt:now.toISOString(),usuario:u.profile?.nome||u.name||u.email||u.uid,perfil:u.role.toUpperCase(),modulo:action==='portal-admin'?'Portal do Aluno / Acesso administrativo':action.startsWith('academic-document-')?'Secretaria Acadêmica / Documentos':action.startsWith('exam-')?'Gestão de Avaliações':action.startsWith('asaas-')?'Financeiro / Asaas':action.startsWith('email-')?'E-mails':action.startsWith('notices-')?'Avisos':action.startsWith('staff-')?'Acessos':'Sistema / '+action,acao:(failed?'Não concluído: ':'Concluído: ')+(auditActionNames[action]||action)+(details.length?' • '+details.join(' • '):''),actorUid:u.uid,actionKey:action==='portal-admin'?b.callAction:action,origem:'servidor'});}catch{console.warn('SE7: não foi possível gravar o registro de auditoria.');}};
 try{const result=await dispatchOperation(services,req,b);await record(result);return result;}catch(error){await record(null,true);throw error;}
}

export default async function handler(req,res){
 let requestedAction='';
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try {
  const native=scannerCors(req,res);if(req.method==='OPTIONS'&&native){res.status(204).end();return;}if(req.method!=='POST')fail(405,'Use POST.');const origin=req.headers.origin;if(origin!=='https://sistema-escolar-ten-mu.vercel.app'&&!native)fail(403,'Origem não autorizada.');
  if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Envie JSON.');let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{fail(400,'JSON inválido.');}if(!b||Array.isArray(b)||typeof b.action!=='string'||JSON.stringify(b).length>(['internship-agreement-file-upload','internship-student-term-file-upload'].includes(b.action)?2900000:(b.action==='internship-preceptor-document-upload'||b.action==='internship-document-upload'||b.action==='portal-admin'&&b.callAction==='internship-document-upload')?750000:b.action.startsWith('internship-payroll-')?750000:b.action==='materials-save'?2900000:b.action==='collaborator-save'?350000:b.action==='notices-save'||b.action==='exam-scan-preview'||b.action==='payroll-receipt-save'||b.action==='expenses-pay'||b.action==='expenses-receipt-save'||b.action==='attendance-justification-save'?750000:['internship-evaluate','internship-evaluation-draft-save','internship-criteria-save'].includes(b.action)?50000:b.action==='exam-save'?250000:(['profile-save','staff-profile-save','student-avatar-save'].includes(b.action)||(b.action==='portal-admin'&&b.callAction==='student-avatar-save'))?100000:12000))fail(400,'Requisição inválida.');
  requestedAction=b.action==='portal-admin'?String(b.callAction||''):b.action;
  if(!nativeRequestAllowed(req,b))fail(403,'Operação não permitida para o leitor de avaliações.');
  if(!process.env.SE7_MASTER_UID)throw new Error('Master não configurado.');const result=await dispatch(services(),req,b);res.status(200).json(result);
 }catch(e){if(requestedAction.startsWith('renegotiation-')&&(!e.status||e.status===500)){console.error('SE7 renegotiation consultation',{action:requestedAction,code:String(e.code||'internal').slice(0,80),name:String(e.name||'Error').slice(0,60),frames:String(e.stack||'').split('\n').slice(1,6).map(line=>line.trim())});e=consultationFailure(e);}const status=e.status||500;if(status===500)console.error('SE7 API',e.code||'internal');res.status(status).json({error:status===500?'Não foi possível concluir. Verifique a configuração do servidor.':e.message,...(e.safeCode?{code:e.safeCode}:{})});}
}
