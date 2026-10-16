import {studentCapacity} from './student-capacity.mjs';
import {institutionDatabase,safePart} from './institution-scope.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export const pilotAllowed=new Set(['session','audit-event','audit-list','staff-list','exam-catalog','notices-catalog','notices-get','notices-feed','course-save','class-save','polo-catalog','polo-save','polo-state','academic-entry-migrate','notices-list','notices-save','notices-delete']);
export async function platformOwner(auth,req){const token=String(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)fail(401,'Entre no Matriz.');let user;try{user=await auth.verifyIdToken(token,true);}catch{fail(401,'Sessão inválida.');}return user;}
async function accountAccess(db,user){if(user.uid===process.env.COMMERCIAL_OWNER_UID)return {company:true};const s=await db.collection('academicUsers').doc(user.uid).get();const a=s.data();if(!s.exists||!a.enabled||a.role!=='master')fail(403,'Conta sem acesso Master institucional.');safePart(a.institutionId);return {...a,company:false};}
export async function choices(db,user,account){const c=await db.collection('commercialPrivate').doc('catalog').get();if(!c.exists)fail(409,'Prepare primeiro o cadastro das instituições no comercial.');return {institutions:(c.data().institutions||[]).filter(i=>account.company||i.id===account.institutionId).map(i=>({id:i.id,name:i.name})),mustChangePassword:!!account.mustChangePassword};}
export async function prepareContext({auth,db},req,body){
 if(process.env.SE7_PLATFORM_PILOT!=='1')fail(503,'Esta versão é exclusiva da cópia de testes.');
 if(body.action==='public-info')return {result:{institution:{name:'SE7 • Matriz de testes'}}};
 const user=await platformOwner(auth,req),account=await accountAccess(db,user);
 if(body.action==='platform-access')return {result:await choices(db,user,account)};
 if(body.action==='platform-password'){
 if(account.company||!account.mustChangePassword)fail(409,'Sua conta não tem troca inicial pendente.');
 const password=body.password;if(typeof password!=='string'||password.length<12||password.length>128||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))fail(400,'Use de 12 a 128 caracteres, incluindo letras e números.');
 if(!Number.isFinite(user.auth_time)||Date.now()/1000-user.auth_time>300)fail(401,'Entre novamente com a senha temporária para continuar.');
 await auth.updateUser(user.uid,{password});await auth.revokeRefreshTokens(user.uid);
 await db.collection('academicUsers').doc(user.uid).update({mustChangePassword:false,passwordChangedAt:new Date().toISOString()});
 return {result:{ok:true,reauthenticate:true}};
 }
 if(account.mustChangePassword)fail(403,'Redefina sua senha antes de acessar a instituição.');
 const institutionId=safePart(req.headers['x-se7-institution']);
 if(!account.company&&institutionId!==account.institutionId)fail(403,'Instituição não autorizada para esta conta.');
 const catalog=await db.collection('commercialPrivate').doc('catalog').get();const institution=(catalog.data()?.institutions||[]).find(i=>i.id===institutionId);if(!institution)fail(403,'Instituição não autorizada.');
 const scoped=institutionDatabase(db,institutionId),profile={uid:user.uid,email:user.email||'',nome:account.name||user.name||process.env.COMMERCIAL_OWNER_NAME||'Master',perfil:'master',institutionId,poloId:'',poloIds:[]};
 if(['platform-student-create','platform-enrollment-operation'].includes(body.action))return {result:await studentCapacity(db,institutionId,{...user,role:'master',profile},body)};
 if(body.action==='platform-select'){
 await db.runTransaction(async tx=>{const config=scoped.collection('config').doc('institution');const a=await tx.get(config);if(account.company)tx.set(db.collection('academicPlatformOwners').doc(user.uid),{active:true});if(!a.exists)tx.set(config,{name:institution.name,razao:institution.legalName||'',cnpj:institution.cnpj||'',email:institution.contactEmail||'',platformInstitutionId:institutionId});});
 return {result:{institution:{id:institutionId,name:institution.name},profile}};
 }
 if(!pilotAllowed.has(body.action))fail(409,'Esta operação ainda não está habilitada nesta etapa de testes. Integrações externas e criação de outros perfis continuam desativadas.');
 // Tenant admins use only their institution database. No global Auth claims are set.
 req.se7PlatformIdentity={...user,role:'master',profile};return {services:{auth,db:scoped}};
}
