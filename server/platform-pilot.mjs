import {publicMaintenance} from './platform-maintenance.mjs';
import {studentCapacity} from './student-capacity.mjs';
import {institutionDatabase,safePart} from './institution-scope.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export const pilotAllowed=new Set(['session','audit-event','audit-list','staff-list','exam-catalog','exam-get','exam-save','exam-roster','exam-print','exam-scan-start','exam-scan-preview','exam-scan-review','exam-scan-status','exam-results','exam-result','exam-verify','notices-catalog','notices-get','notices-feed','course-save','class-save','polo-catalog','polo-save','polo-state','notices-list','notices-save','notices-delete']);
export async function platformOwner(auth,req){const token=String(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)fail(401,'Entre no Matriz.');let user;try{user=await auth.verifyIdToken(token,true);}catch{fail(401,'Sessão inválida.');}return user;}
async function accountAccess(db,user){if(user.uid===process.env.COMMERCIAL_OWNER_UID)return {company:true};const s=await db.collection('academicUsers').doc(user.uid).get();const a=s.data();if(!s.exists||!a||a.enabled!==true||a.role!=='master')fail(403,'Conta sem acesso Master institucional.');safePart(a.institutionId);return {...a,company:false};}
export async function choices(db,user,account){const c=await db.collection('commercialPrivate').doc('catalog').get();if(!c.exists)fail(409,'Prepare primeiro o cadastro das instituições no comercial.');return {institutions:(Array.isArray(c.data().institutions)?c.data().institutions:[]).filter(i=>i&&typeof i.id==='string'&&(account.company||i.id===account.institutionId)).map(i=>({id:i.id,name:i.name})),mustChangePassword:!!account.mustChangePassword};}

// Diagnóstico de homologação: somente leitura, exclusivamente para o proprietário comercial.
// Não cria documentos, não lista alunos e não devolve dados pessoais ou credenciais.
export async function platformDiagnostic(db,account,body){
 if(!account.company)fail(403,'Diagnóstico exclusivo do proprietário comercial.');
 const catalog=await db.collection('commercialPrivate').doc('catalog').get();
 const institutions=Array.isArray(catalog.data()?.institutions)?catalog.data().institutions:[];
 const requested=body.institutionIds;
 if(!Array.isArray(requested)||requested.length!==2||requested[0]===requested[1])fail(400,'Informe duas instituições distintas para homologação.');
 const ids=requested.map(safePart);
 if(ids.some(id=>!institutions.some(i=>i?.id===id)))fail(403,'Instituição não cadastrada no catálogo comercial.');
 const projectId=db.projectId||db._settings?.projectId||'não informado pelo SDK';
 if(process.env.COMMERCIAL_FIREBASE_PROJECT_ID==='sistema-escolar-nuvem'||process.env.SE7_PLATFORM_PILOT!=='1')fail(503,'Diagnóstico indisponível fora do Firebase comercial.');
 const checks=[];
 for(const id of ids){
  const scoped=institutionDatabase(db,id);
  const collections={};
  for(const name of ['students','courses','classes','academicCalendars','polos']){
   const sample=await scoped.collection(name).limit(1).get();
   collections[name]={queryOk:true,hasDocuments:!sample.empty&&sample.docs.length>0};
  }
  const config=await scoped.collection('config').doc('institution').get();
  checks.push({institutionId:id,scopedPrefix:'academicInstitutions/'+id+'/',configExists:config.exists,collections});
 }
 return {readOnly:true,projectMatchesConfiguration:projectId==='não informado pelo SDK'?null:projectId===process.env.COMMERCIAL_FIREBASE_PROJECT_ID,projectId:process.env.COMMERCIAL_FIREBASE_PROJECT_ID,checks,scopeDistinct:checks[0].scopedPrefix!==checks[1].scopedPrefix,executedAt:new Date().toISOString(),limitations:['Não testa regras do SDK cliente: Admin SDK ignora regras Firestore.','Não testa gravação, matrícula ou limite de alunos.','Não comprova isolamento de permissões do Firebase Auth sem usuários de teste.']};
}

export async function prepareContext({auth,db},req,body){
 if(process.env.SE7_PLATFORM_PILOT!=='1')fail(503,'Esta versão é exclusiva da cópia de testes.');
 if(body.action==='public-info')return {result:{institution:{name:'SE7 • Matriz de testes'}}};
 const user=await platformOwner(auth,req),account=await accountAccess(db,user);
 if(body.action==='platform-access')return {result:await choices(db,user,account)};
 if(body.action==='platform-diagnostic')return {result:await platformDiagnostic(db,account,body)};
 if(body.action==='platform-password'){
 if(account.company||!account.mustChangePassword)fail(409,'Sua conta não tem troca inicial pendente.');
 const password=body.password;if(typeof password!=='string'||password.length<12||password.length>128||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))fail(400,'Use de 12 a 128 caracteres, incluindo letras e números.');
 if(!Number.isFinite(user.auth_time)||user.auth_time>Date.now()/1000+30||Date.now()/1000-user.auth_time>300)fail(401,'Entre novamente com a senha temporária para continuar.');
 await auth.updateUser(user.uid,{password});await auth.revokeRefreshTokens(user.uid);
 await db.collection('academicUsers').doc(user.uid).update({mustChangePassword:false,passwordChangedAt:new Date().toISOString()});
 return {result:{ok:true,reauthenticate:true}};
 }
 if(account.mustChangePassword)fail(403,'Redefina sua senha antes de acessar a instituição.');
 const institutionId=safePart(req.headers['x-se7-institution']);
 if(!account.company&&institutionId!==account.institutionId)fail(403,'Instituição não autorizada para esta conta.');
 const catalog=await db.collection('commercialPrivate').doc('catalog').get();const institution=(Array.isArray(catalog.data()?.institutions)?catalog.data().institutions:[]).find(i=>i?.id===institutionId);if(!institution)fail(403,'Instituição não autorizada.');
 if(body.action==='platform-maintenance')return {result:{maintenance:publicMaintenance((await db.collection('commercialPrivate').doc('maintenance').get()).data(),institutionId)}};
 if(!institution.own){const onboarding=(await db.collection('commercialOnboarding').doc(institutionId).get()).data();if(onboarding?.required&&!onboarding.activatedAt)fail(403,'Instituição em implantação. Aguarde a liberação da equipe comercial.');}
 const maintenance=(await db.collection('commercialPrivate').doc('maintenance').get()).data(),activeMaintenance=publicMaintenance(maintenance,institutionId);

 if(activeMaintenance)throw Object.assign(new Error('Sistema em manutenção. Por favor, aguarde.'),{status:503,maintenance:activeMaintenance});
 const scoped=institutionDatabase(db,institutionId),profile={uid:user.uid,email:user.email||'',nome:account.name||user.name||process.env.COMMERCIAL_OWNER_NAME||'Master',perfil:'master',institutionId,poloId:'',poloIds:[]};
 if(['platform-student-create','platform-enrollment-operation'].includes(body.action))return {result:await studentCapacity(db,institutionId,{...user,role:'master',profile},body)};
 if(body.action==='platform-select'){
 await db.runTransaction(async tx=>{const config=scoped.collection('config').doc('institution');const a=await tx.get(config);if(account.company)tx.set(db.collection('academicPlatformOwners').doc(user.uid),{active:true});if(!a.exists)tx.set(config,{name:institution.name,razao:institution.legalName||'',cnpj:institution.cnpj||'',email:institution.contactEmail||'',platformInstitutionId:institutionId});});
 return {result:{institution:{id:institutionId,name:institution.name},profile}};
 }
 // Leitura acadêmica do Portal do Aluno, restrita ao Master institucional.
 // Snapshot e recibos ficam bloqueados até a homologação financeira e de privacidade.
 if(body.action==='portal-preview'){
  const readOnly=new Set(['list','exam-results','exam-result','notices-feed','notices-open']);
  if(!readOnly.has(body.operation))fail(403,'Operação de visualização não habilitada para testes.');
 }else if(!pilotAllowed.has(body.action))fail(409,'Esta operação ainda não está habilitada nesta etapa de testes. Integrações externas e criação de outros perfis continuam desativadas.');
 // Tenant admins use only their institution database. No global Auth claims are set.
 req.se7PlatformIdentity={...user,role:'master',profile};return {services:{auth,db:scoped}};
}
