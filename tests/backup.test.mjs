import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore,Timestamp,GeoPoint} from 'firebase-admin/firestore';
import {dispatch,encode,decode} from '../server/backup.mjs';
import {restoreToEmulator} from '../server/backup-recovery.mjs';

test('criptografia de backup valida senha, integridade e corrupção',async()=>{
 const context={window:{},crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob};vm.runInNewContext(readFileSync('assets/se7-backup-crypto.js','utf8'),context);
 const c=context.window.SE7BackupCrypto,data={format:'SE7-DATA-BACKUP',project:'sistema-escolar-nuvem',documents:[{path:'students/test',exists:true,data:encode({fullname:'Nome confidencial'})}],users:[]};
 const sealed=await c.seal(data,'Senha-teste-backup-123');assert(!JSON.stringify(sealed).includes('Nome confidencial'));assert.equal((await c.open(sealed,'Senha-teste-backup-123')).documents.length,1);
 await assert.rejects(()=>c.open(sealed,'senha-incorreta-123'));await assert.rejects(()=>c.open({...sealed,ciphertext:sealed.ciphertext.slice(0,-8)+'AAAAAAAA'},'Senha-teste-backup-123'));
});
test('exportação restrita ao master e recuperação bloqueada em produção',async()=>{
 await assert.rejects(()=>dispatch({}, {},{action:'backup-catalog'},{role:'secretaria',uid:'sec'}),e=>e.status===403);
 await assert.rejects(()=>restoreToEmulator({projectId:'sistema-escolar-nuvem'},{}),/apenas/);
});
test('exporta subcoleção sob pai ausente e restaura tipos reais no emulador',async()=>{
 const app=initializeApp({projectId:'demo-se7-backup'},'backup-tests'),db=getFirestore(app);const old=process.env.SE7_MASTER_UID;process.env.SE7_MASTER_UID='backup-master';
 try{
  const source={date:new Timestamp(123,987654000),geo:new GeoPoint(-1,2),bytes:Buffer.from([0,255,5]),reference:db.doc('students/ref'),map:{literal:['timestamp',1,2]},numbers:[NaN,Infinity,-Infinity,-0]};
  await db.doc('backupFixture/missing/children/child').set(source);
  const u={role:'master',uid:'backup-master'};const parent=await dispatch(db,{}, {action:'backup-page',path:'backupFixture',offset:0},u);assert.equal(parent.rows[0].exists,false);assert(parent.rows[0].collections.includes('backupFixture/missing/children'));
  const child=await dispatch(db,{}, {action:'backup-page',path:'backupFixture/missing/children'},u);const decoded=decode(child.rows[0].data,db);assert.equal(decoded.date.nanoseconds,987654000);assert(decoded.bytes.equals(source.bytes));assert.equal(decoded.reference.path,'students/ref');assert(Number.isNaN(decoded.numbers[0]));assert(Object.is(decoded.numbers[3],-0));
  await db.doc(child.rows[0].path).delete();const result=await restoreToEmulator(db,{format:'SE7-DATA-BACKUP',version:1,project:'sistema-escolar-nuvem',documents:[...parent.rows,...child.rows]});assert.equal(result.restored,1);const recovered=(await db.doc(child.rows[0].path).get()).data();assert.equal(recovered.date.nanoseconds,987654000);assert(recovered.bytes.equals(source.bytes));assert.equal(recovered.reference.path,'students/ref');
 }finally{process.env.SE7_MASTER_UID=old;await app.delete();}
});
