import {services,FieldValue as F} from '../server/admin.mjs';
import {randomBytes} from 'node:crypto';
import {roles,tabs,docTypes,digest,cpfKey,studentUid,alias,validId,password,hashPassword,verifyPassword,publicStudent,validCPF} from '../server/security.mjs';
const PROJECT='sistema-escolar-nuvem';
const APIKEY='AIzaSyBeJ-fqzwiQt0PZEKQ6e8zAPSuh7WRuaHo';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const at=()=>F.serverTimestamp();
async function authPassword(email,senha){const r=await fetch(`${process.env.NODE_ENV==='test'&&process.env.FIREBASE_AUTH_EMULATOR_HOST?'http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1':'https://identitytoolkit.googleapis.com/v1'}/accounts:signInWithPassword?key=${APIKEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:senha,returnSecureToken:true}),signal:AbortSignal.timeout(10000)});const d=await r.json();return r.ok?d:null;}
async function limits(db,req,action,account=''){
 const ip=req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown';const bucket=Math.floor(Date.now()/900000);
 for(const [key,max] of [[`ip:${ip}`,action==='signup'?8:40],...(account?[[`account:${account}`,12]]:[])]){
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
export async function dispatch({auth,db},req,b){
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
   const code=`MAT-${new Date().getFullYear()}-${ref.id.slice(-8).toUpperCase()}`;await ref.set({...s,code,dob:s.birthDate,classId:'',status:'Ativo',documentos:{},attendance:{},se7AuthUid:uid,portalSessionVersion:0,createdAt:new Date().toISOString()});await idx.set({studentId:ref.id});return {customToken:await auth.createCustomToken(uid,{role:'aluno',studentId:ref.id,portalVersion:0}),student:{id:ref.id,...s,code}};
  }catch(e){await auth.deleteUser(uid).catch(()=>{});await ref.delete().catch(()=>{});await idx.delete();throw e;}
 }
 const u=await identity(auth,db,req);
 if(action==='session'){
  if(u.role==='aluno')return {profile:{id:u.studentId,...publicStudent(u.student)},role:u.role};
  if(u.role==='master')await claims(auth,u.uid,{role:'master'});
  return {profile:{uid:u.uid,email:u.email,nome:u.profile?.nome||u.name||u.email||'Master',perfil:u.role},role:u.role};
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
  if(action==='qr'){return db.runTransaction(async tx=>{const snap=await tx.get(ref);const token=snap.data().qrAttendanceToken||randomBytes(24).toString('hex');tx.update(ref,{qrAttendanceToken:token,qrAttendanceVersion:1});return {token};});}
  if(action==='documents'){
   if(u.student.documentos?.[b.type]?.status==='Aprovado')fail(400,'Documento já aprovado. Solicite ajuda à instituição.');
   if(!docTypes.includes(b.type)||typeof b.fileName!=='string'||b.fileName.length>180||typeof b.url!=='string'||b.url.length>1000||b.url&&!/^https:\/\//.test(b.url))fail(400,'Documento inválido.');
   await ref.update({[`documentos.${b.type}`]:{status:'Pendente',fileName:b.fileName,driveUrl:b.url}});return {ok:true};
  }
  if(action==='student-config'){const d=(await db.collection('config').doc('institution').get()).data()||{};return {...await publicInfo(db),gdriveUrl:typeof d.gdriveUrl==='string'?d.gdriveUrl:''};}
  fail(403,'Operação não permitida.');
 }
 if(action==='prepare-student'){if(!['master','secretaria'].includes(u.role))fail(403,'Acesso restrito.');const d=await db.collection('students').doc(validId(b.id)).get();if(!d.exists)fail(404,'Aluno não encontrado.');await prepareStudent(db,d);return {ok:true};}
 if(action==='attendance'){
  if(!['totem','master'].includes(u.role))fail(403,'Acesso restrito ao Totem.');await limits(db,req,'attendance:'+u.uid);
  if(typeof b.qr!=='string'||!/^SE7:ATTENDANCE:1:[a-f0-9]{48}$/.test(b.qr))fail(400,'QR Code inválido.');
  const matches=await db.collection('students').where('qrAttendanceToken','==',b.qr.split(':')[3]).limit(2).get();if(matches.size!==1)fail(404,'Aluno não identificado.');const d=matches.docs[0],s=d.data();if(s.portalBlocked||!['Ativo','Ativa'].includes(s.status)||!s.classId)fail(403,'Aluno sem matrícula ativa ou turma. Procure a secretaria.');
  const now=new Date(),date=now.toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});const ref=db.collection('attendance').doc(`presenca_${d.id}_${date}`);
  const repeated=await db.runTransaction(async tx=>{const existing=await tx.get(ref);if(existing.exists)return true;tx.set(ref,{studentId:d.id,nomeAluno:s.fullname||'Aluno',data:date,horario:now.toLocaleTimeString('pt-BR',{timeZone:'America/Fortaleza'}),status:'PRESENTE',registradoPor:'Totem QR autenticado',actorUid:u.uid,createdAt:at()});return false;});return {name:s.fullname||'Aluno',repeated};
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
  password(b.password);if(!roles.includes(b.role)||typeof b.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||typeof b.name!=='string'||!b.name.trim())fail(400,'Informe nome, e-mail e um perfil permitido.');
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
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try {
  if(req.method!=='POST')fail(405,'Use POST.');const origin=req.headers.origin;if(origin!=='https://sistema-escolar-ten-mu.vercel.app')fail(403,'Origem não autorizada.');
  if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'Envie JSON.');const b=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!b||typeof b.action!=='string'||JSON.stringify(b).length>12000)fail(400,'Requisição inválida.');
  if(!process.env.SE7_MASTER_UID)throw new Error('Master não configurado.');const result=await dispatch(services(),req,b);res.status(200).json(result);
 }catch(e){const status=e.status||500;if(status===500)console.error('SE7 API',e.code||'internal');res.status(status).json({error:status===500?'Não foi possível concluir. Verifique a configuração do servidor.':e.message});}
}
