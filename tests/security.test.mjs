import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,collection,getDocs,query,where} from 'firebase/firestore';
import {dispatch} from '../api/se7.js';
import {hashPassword,verifyPassword,studentUid,cpfKey} from '../server/security.mjs';
const project='demo-se7',MASTER='UUBINdHfJZONVMcC0QogyAsUgvA3';
process.env.SE7_MASTER_UID=MASTER;process.env.NODE_ENV='test';
const app=initializeApp({projectId:project});const auth=getAuth(app),db=getFirestore(app);let env,masterToken,studentToken;
const req=token=>({headers:{authorization:'Bearer '+token,'x-vercel-forwarded-for':'127.0.0.1'}});
const call=(token,b)=>dispatch({auth,db},req(token),b);
async function signIn(email,password){const r=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});const d=await r.json();assert(r.ok,JSON.stringify(d));return d.idToken;}
async function custom(token){const r=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,returnSecureToken:true})});const d=await r.json();assert(r.ok,JSON.stringify(d));return d.idToken;}
before(async()=>{env=await initializeTestEnvironment({projectId:project,firestore:{rules:readFileSync('firestore.rules','utf8')}});await auth.createUser({uid:MASTER,email:'master@example.test',password:'master-test-123'});masterToken=await signIn('master@example.test','master-test-123');await db.collection('students').doc('s1').set({fullname:'Aluno 1',cpf:'529.982.247-25',code:'MAT-ONE',senhaAluno:'legacy-password',status:'Ativo',classId:'c1',courseId:'course1'});await db.collection('students').doc('s2').set({fullname:'Aluno 2',cpf:'111.444.777-35',code:'MAT-TWO',status:'Ativo',classId:'c2',courseId:'course2'});await db.collection('financeLogs').doc('f1').set({studentId:'s1',amount:25});await db.collection('financeLogs').doc('f2').set({studentId:'s2',amount:25});});
after(async()=>{await env?.cleanup();await app.delete();});
test('HTML e JS preservam sintaxe e IDs únicos',()=>{for(const name of ['index.html','app-aluno.html','app-financeiro.html','totem.html','administracao-auth.html']){const h=readFileSync(name,'utf8');for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);const ids=[...h.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size,name);}new vm.Script(readFileSync('assets/se7-auth.js','utf8'));new vm.Script(readFileSync('assets/se7-totem.js','utf8'));});
test('hash legada permanece verificável com salt',async()=>{const h=await hashPassword('segredo-123');assert(await verifyPassword('segredo-123',h));assert(!await verifyPassword('errada',h));assert.notEqual(h.salt,(await hashPassword('segredo-123')).salt);});
test('migração guarda credencial privada e não modifica notas/foto',async()=>{await db.collection('students').doc('s1').update({fotoAluno:'foto-original',grades:{disciplina:9}});const d=await call(masterToken,{action:'migrate-students'});assert(d.results.every(x=>x.ok));const s=(await db.collection('students').doc('s1').get()).data();assert.equal(s.senhaAluno,undefined);assert.equal(s.portalCredential,undefined);assert.equal(s.fotoAluno,'foto-original');assert.equal(s.grades.disciplina,9);assert((await db.collection('se7Credentials').doc('s1').get()).exists);assert.equal((await db.collection('se7CpfIndex').doc(cpfKey('52998224725')).get()).data().studentId,'s1');});
test('login inválido e cadastro sem autoridade não ganham perfil',async()=>{await assert.rejects(call(null,{action:'student-login',cpf:'52998224725',password:'errada'}),/inválidos/);await auth.createUser({uid:'outsider',email:'outsider@example.test',password:'outsider-123'});const token=await signIn('outsider@example.test','outsider-123');await assert.rejects(call(token,{action:'session',role:'master'}),/sem permissão/);await assert.rejects(call(token,{action:'staff-create',role:'master',email:'a@test.com',password:'password-123',name:'A'}),/sem permissão/);});
test('primeiro login migra para Auth e remove a credencial privada',async()=>{const d=await call(null,{action:'student-login',cpf:'52998224725',password:'legacy-password'});studentToken=await custom(d.customToken);const s=await call(studentToken,{action:'session'});assert.equal(s.role,'aluno');assert.equal(s.profile.id,'s1');assert.equal((await db.collection('se7Credentials').doc('s1').get()).exists,false);assert((await auth.getUser(studentUid('s1'))).customClaims.studentId==='s1');await assert.rejects(call(studentToken,{action:'reset-student',id:'s2'}),/não permitida/);});
test('documentos: reenvio gera nova versão, preserva análises e volta a pendente',async()=>{
 const ref=db.collection('students').doc('s1');
 const first=await call(studentToken,{action:'documents',type:'rg_cnh',fileName:'rg.pdf',url:'https://drive.google.com/file/rg'});
 let student=(await ref.get()).data();assert.equal(student.documentos.rg_cnh.status,'Pendente');assert.equal(student.documentos.rg_cnh.submissionId,first.submissionId);assert(student.documentos.rg_cnh.submittedAt);
 const history=[{status:'Reprovado',motivo:'Imagem cortada',submissionId:first.submissionId}];
 await ref.update({'documentos.rg_cnh.status':'Reprovado','documentos.rg_cnh.motivoReprovacao':'Imagem cortada','documentos.rg_cnh.reviewHistory':history,'documentos.cpf':{status:'Pendente',fileName:'cpf.pdf',driveUrl:'https://drive.google.com/file/cpf'}});
 const next=await call(studentToken,{action:'documents',type:'rg_cnh',fileName:'rg-corrigido.pdf',url:'https://drive.google.com/file/new'});
 student=(await ref.get()).data();assert.notEqual(first.submissionId,next.submissionId);assert.equal(student.documentos.rg_cnh.status,'Pendente');assert.equal(student.documentos.rg_cnh.motivoReprovacao,'');assert.deepEqual(student.documentos.rg_cnh.reviewHistory,history);assert.equal(student.documentos.cpf.fileName,'cpf.pdf');assert.equal(student.grades.disciplina,9);
 await ref.update({'documentos.rg_cnh.status':'Aprovado'});
 await assert.rejects(call(studentToken,{action:'documents',type:'rg_cnh',fileName:'rg.pdf',url:'https://drive.google.com/file/third'}),/já aprovado/);
});
test('regras: anônimo não lê cadastros; aluno lê somente próprios dados e faturas',async()=>{const anon=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(anon,'students/s1')));const s=env.authenticatedContext(studentUid('s1'),{studentId:'s1',portalVersion:0}).firestore();await assertSucceeds(getDoc(doc(s,'students/s1')));await assertFails(getDoc(doc(s,'students/s2')));await assertFails(getDocs(collection(s,'students')));await assertSucceeds(getDocs(query(collection(s,'financeLogs'),where('studentId','==','s1'))));await assertFails(getDocs(collection(s,'financeLogs')));await assertFails(updateDoc(doc(s,'students/s1'),{fotoAluno:'fraude'}));await assertFails(updateDoc(doc(s,'students/s1'),{portalBlocked:false}));await assertFails(setDoc(doc(s,'se7Staff/'+studentUid('s1')),{perfil:'master',disabled:false}));await assertFails(getDoc(doc(s,'se7Credentials/s1')));await assertFails(setDoc(doc(s,'students/s1/portalAdminEvents/fake'),{action:'fraude'}));});
test('contadores gravam juntos; QR renova e tem validade de 30 segundos',async()=>{await call(studentToken,{action:'event',type:'tab',tab:'notas'});const s=(await db.collection('students').doc('s1').get()).data();assert.equal(s.portalTabCounts.notas,1);assert.equal((await db.collection('students').doc('s1').collection('portalAccessEvents').get()).size,1);const first=await call(studentToken,{action:'qr'}),again=await call(studentToken,{action:'qr'});assert.notEqual(first.token,again.token);assert.equal(first.ttlSeconds,30);assert.equal(first.expiresAt-first.serverTime,30000);assert.equal(first.qr,'SE7:ATTENDANCE:2:'+first.token);assert(/^[a-f0-9]{48}$/.test(first.token));});
test('master gera senha temporária, invalida versão antiga e exige troca',async()=>{const r=await call(masterToken,{action:'reset-student',id:'s1'});assert.equal(r.temporary.length,18);await assert.rejects(call(studentToken,{action:'qr'}));const login=await call(null,{action:'student-login',cpf:'52998224725',password:r.temporary});const token=await custom(login.customToken);assert((await call(token,{action:'session'})).profile.portalMustChangePassword);await assert.rejects(call(token,{action:'qr'}),/nova senha/);await assert.rejects(call(token,{action:'change-password',password:r.temporary}),/diferente/);const changed=await call(token,{action:'change-password',password:'nova-senha-987'});studentToken=await custom(changed.customToken);assert.equal((await call(studentToken,{action:'session'})).profile.portalMustChangePassword,false);const rulesOld=env.authenticatedContext(studentUid('s1'),{studentId:'s1',portalVersion:0}).firestore();await assertFails(getDoc(doc(rulesOld,'students/s1')));await assert.rejects(call(null,{action:'student-login',cpf:'52998224725',password:r.temporary}));});
test('bloqueio impede acesso e liberação permite novo login',async()=>{await call(masterToken,{action:'block-student',id:'s1',blocked:true});await assert.rejects(call(studentToken,{action:'session'}));await assert.rejects(call(null,{action:'student-login',cpf:'52998224725',password:'nova-senha-987'}));await call(masterToken,{action:'block-student',id:'s1',blocked:false});const login=await call(null,{action:'student-login',cpf:'52998224725',password:'nova-senha-987'});studentToken=await custom(login.customToken);assert.equal((await call(studentToken,{action:'session'})).profile.id,'s1');});
test('funcionário é provisionado só pelo master; sem privilégios de auditoria',async()=>{const d=await call(masterToken,{action:'staff-create',email:'financeiro@example.test',name:'Financeiro',password:'financeiro-987',role:'financeiro'});const token=await signIn('financeiro@example.test','financeiro-987');assert.equal((await call(token,{action:'session'})).role,'financeiro');await assert.rejects(call(token,{action:'reset-student',id:'s1'}),/master/);const f=env.authenticatedContext(d.uid).firestore();await assertSucceeds(getDocs(collection(f,'students')));await assertFails(getDocs(collection(f,'students/s1/portalAccessEvents')));await assertFails(updateDoc(doc(f,'students/s1'),{fotoAluno:'fraude'}));await call(masterToken,{action:'staff-disable',uid:d.uid});await assertFails(getDocs(collection(f,'students')));});
test('sem autenticação não é possível forjar presença',async()=>{await assert.rejects(call(null,{action:'attendance',qr:'SE7:ATTENDANCE:1:'+'a'.repeat(48)}));await assert.rejects(call(studentToken,{action:'attendance',qr:'SE7:ATTENDANCE:1:'+'a'.repeat(48)}),/não permitida/);});
test('expiração temporária nega login e limites não liberam enumeração',async()=>{await db.collection('students').doc('s2').update({portalMustChangePassword:true,portalTemporaryExpiresAt:'2020-01-01T00:00:00Z'});await assert.rejects(call(null,{action:'student-login',cpf:'11144477735',password:'MAT-TWO'}),/expirado/);await assert.rejects(call(studentToken,{action:'event',type:'tab',tab:'master'}),/inválido/);});
test('matrícula pública ignora privilégios enviados e permite e-mail opcional',async()=>{await db.collection('courses').doc('course-new').set({name:'Curso teste'});const d=await call(null,{action:'signup',password:'matricula-987',student:{fullname:'Novo Aluno',birthDate:'2000-01-01',gender:'F',cpf:'123.456.789-09',rg:'123',whatsapp:'85999999999',cep:'60000000',street:'Rua',number:'1',neighborhood:'Bairro',city:'Fortaleza',state:'CE',courseId:'course-new',portalBlocked:false,role:'master',fotoAluno:'fraude'}});const token=await custom(d.customToken);const session=await call(token,{action:'session'});assert.equal(session.role,'aluno');assert.equal(session.profile.fotoAluno,undefined);assert.equal(session.profile.role,undefined);assert.equal(session.profile.email,undefined);await assert.rejects(call(token,{action:'staff-create',role:'financeiro'}));await assert.rejects(call(null,{action:'signup',password:'matricula-987',student:{fullname:'Repetido',birthDate:'2000-01-01',gender:'F',cpf:'12345678909',rg:'123',whatsapp:'85999999999',cep:'60000000',street:'Rua',number:'1',neighborhood:'Bairro',city:'Fortaleza',state:'CE',courseId:'course-new'}}),/Já existe/);});
test('QR do Totem registra uma vez ao dia e não altera notas ou faturas',async()=>{const account=await call(masterToken,{action:'staff-create',email:'totem@example.test',name:'Totem',password:'totem-987',role:'totem'});const token=await signIn('totem@example.test','totem-987');const qr=await call(studentToken,{action:'qr'});const first=await call(token,{action:'attendance',qr:qr.qr});assert.equal(first.repeated,false);await assert.rejects(call(token,{action:'attendance',qr:qr.qr}),/já utilizado/);const next=await call(studentToken,{action:'qr'});const repeat=await call(token,{action:'attendance',qr:next.qr});assert.equal(repeat.repeated,true);const s=(await db.collection('students').doc('s1').get()).data();assert.equal(s.grades.disciplina,9);assert.equal((await db.collection('financeLogs').doc('f1').get()).data().amount,25);const kiosk=env.authenticatedContext(account.uid).firestore();await assertFails(getDocs(collection(kiosk,'students')));});

test('troca de master: conta anterior passa a financeiro sem preservar poder master',async()=>{
 const old='JrL8OtZKmRYeSG3olAe8LuxvRNY2';
 await auth.createUser({uid:old,email:'antigo-master@example.test',password:'master-antigo-123'});
 await auth.setCustomUserClaims(old,{role:'master'});
 const token=await signIn('antigo-master@example.test','master-antigo-123');
 await assert.rejects(call(token,{action:'staff-list'}),/sem permissão/);
 await call(masterToken,{action:'staff-link',uid:old,role:'financeiro'});
 assert.equal((await call(token,{action:'session'})).role,'financeiro');
 await assert.rejects(call(token,{action:'staff-list'}),/master/);
 assert.equal((await auth.getUser(old)).customClaims.role,'financeiro');
 const oldRules=env.authenticatedContext(old,{role:'master'}).firestore();
 await assertSucceeds(getDocs(collection(oldRules,'financeLogs')));
 await assertFails(getDocs(collection(oldRules,'students/s1/portalAdminEvents')));
 const newRules=env.authenticatedContext(MASTER).firestore();
 await assertSucceeds(getDocs(collection(newRules,'students/s1/portalAdminEvents')));
 await assert.rejects(call(masterToken,{action:'staff-link',uid:MASTER,role:'financeiro'}),/master não pode/);
});

test('nome do cabeçalho persiste no Auth, mantém perfil e não pode ser alterado por aluno',async()=>{
 const d=await call(masterToken,{action:'profile-name',name:'James André de Souza',role:'financeiro',uid:studentUid('s1')});
 assert.equal(d.profile.perfil,'master');
 assert.equal((await call(masterToken,{action:'session'})).profile.nome,'James André de Souza');
 assert.equal((await auth.getUser(MASTER)).displayName,'James André de Souza');
 await assert.rejects(call(studentToken,{action:'profile-name',name:'Outra pessoa'}),/não permitida/);
 await assert.rejects(call(masterToken,{action:'profile-name',name:'<script>'}),/Informe um nome/);
 const staff=await call(masterToken,{action:'staff-create',email:'nome@example.test',name:'Pessoa Nome',password:'pessoa-nome-123',role:'financeiro'});
 const token=await signIn('nome@example.test','pessoa-nome-123');
 await call(token,{action:'profile-name',name:'Samia Silva',role:'master',uid:MASTER});
 assert.equal((await call(token,{action:'session'})).profile.nome,'Samia Silva');
 assert.equal((await call(token,{action:'session'})).role,'financeiro');
 assert.equal((await db.collection('se7Staff').doc(staff.uid).get()).data().nome,'Samia Silva');
});

test('QR expirado e formato antigo são rejeitados pelo servidor',async()=>{
 const kiosk=await signIn('totem@example.test','totem-987');
 const qr=await call(studentToken,{action:'qr'});
 await db.collection('se7AttendanceQr').doc(studentUid('s1')).update({expiresAt:new Date(Date.now()-1)});
 await assert.rejects(call(kiosk,{action:'attendance',qr:qr.qr}),/expirado/);
 await assert.rejects(call(kiosk,{action:'attendance',qr:'SE7:ATTENDANCE:1:'+qr.token}),/antigo ou inválido/);
 await assert.rejects(call(kiosk,{action:'attendance',qr:'SE7:ATTENDANCE:2:'+'b'.repeat(48)}),/substituído ou inválido/);
});
test('renovar invalida print anterior; coleção dos QR é privada',async()=>{
 const kiosk=await signIn('totem@example.test','totem-987');
 const old=await call(studentToken,{action:'qr'});const fresh=await call(studentToken,{action:'qr'});
 await assert.rejects(call(kiosk,{action:'attendance',qr:old.qr}),/substituído ou inválido/);
 const qrDoc=(await db.collection('se7AttendanceQr').doc(studentUid('s1')).get()).data();
 assert.equal(qrDoc.token,undefined);assert.notEqual(qrDoc.tokenHash,fresh.token);
 assert.equal((await db.collection('students').doc('s1').get()).data().qrAttendanceToken,undefined);
 const own=env.authenticatedContext(studentUid('s1'),{studentId:'s1',portalVersion:2}).firestore();
 await assertFails(getDoc(doc(own,'se7AttendanceQr/'+studentUid('s1'))));
 await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(),'se7AttendanceQr')));
});
test('duas leituras simultâneas consomem QR uma única vez',async()=>{
 const kiosk=await signIn('totem@example.test','totem-987');const qr=await call(studentToken,{action:'qr'});
 const results=await Promise.allSettled([call(kiosk,{action:'attendance',qr:qr.qr}),call(kiosk,{action:'attendance',qr:qr.qr})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.match(results.find(x=>x.status==='rejected').reason.message,/já utilizado/);
 assert.equal((await db.collection('attendance').where('studentId','==','s1').get()).size,1);
});
test('QR já emitido respeita bloqueio e versão de sessão do aluno',async()=>{
 const kiosk=await signIn('totem@example.test','totem-987');const qr=await call(studentToken,{action:'qr'});
 await db.collection('students').doc('s1').update({portalBlocked:true});
 await assert.rejects(call(kiosk,{action:'attendance',qr:qr.qr}),/sem acesso ativo/);
 await db.collection('students').doc('s1').update({portalBlocked:false,portalSessionVersion:999});
 await assert.rejects(call(kiosk,{action:'attendance',qr:qr.qr}),/sem acesso ativo/);
});

test('Asaas: clientes não adulteram cobranças vinculadas nem forjam confirmação',async()=>{
 const m=env.authenticatedContext(MASTER).firestore();
 await db.collection('financeLogs').doc('asaas-rule').set({studentId:'s1',amount:450,date:'2030-09-05',status:'PENDENTE'});
 await assertSucceeds(updateDoc(doc(m,'financeLogs/asaas-rule'),{amount:460}));
 await db.collection('se7AsaasInvoices').doc('asaas-rule').set({studentId:'s1',state:'reserved'});
 await assertFails(updateDoc(doc(m,'financeLogs/asaas-rule'),{status:'PAGO'}));
 await assertFails(deleteDoc(doc(m,'financeLogs/asaas-rule')));
 await assertFails(setDoc(doc(m,'se7AsaasInvoices/forged'),{state:'linked'}));
 await assertFails(setDoc(doc(m,'se7AsaasBulkPlans/forged'),{actor:MASTER}));
 await assertFails(setDoc(doc(m,'financeLogs/asaas-forged'),{studentId:'s1',amount:450,asaasStatus:'RECEIVED'}));
 const uid='asaas-finance-rules';await db.collection('se7Staff').doc(uid).set({perfil:'financeiro',disabled:false});
 const fin=env.authenticatedContext(uid).firestore();
 await assertFails(updateDoc(doc(fin,'financeLogs/asaas-rule'),{amount:1}));
 await assertSucceeds(setDoc(doc(fin,'financeLogs/asaas-local'),{studentId:'s1',amount:450,status:'PENDENTE'}));
 await assert.rejects(call(masterToken,{action:'asaas-link-customer',studentId:'s1',customerId:'bad/path'}));
 await assert.rejects(call(studentToken,{action:'asaas-emit',invoiceId:'asaas-local',billingType:'PIX'}));
 await assert.rejects(call(studentToken,{action:'asaas-bulk-preview',studentId:'s1'}));
});
