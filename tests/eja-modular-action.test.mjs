import test from 'node:test';import assert from 'node:assert/strict';
import {modularStudentExamAction} from '../server/eja-modular-attempt.mjs';
const questions=Array.from({length:10},(_,i)=>({enunciado:'Questão '+i,opcoes:['A','B','C','D','E'],correta:0}));
function harness(date='2026-11-08'){
 const store=new Map();const course={id:'curso',nivel:'Supletivo',ejaMode:'modular',ejaStage:'medio',subjects:[{id:'bio'}]};
 store.set('students/aluna',{courseId:'curso',se7AuthUid:'uid',ejaModularActivation:{source:'asaas-webhook-confirmed',paymentId:'pay',firstPaymentConfirmedDate:date,confirmed:true,months:3}});
 store.set('courses/curso',course);store.set('se7EjaModularExams/curso_bio',{published:true,subjectId:'bio',subjectName:'Biologia',questions});
 const db={collection(name){return {doc(id){const key=name+'/'+id;return {key,async get(){return {exists:store.has(key),data:()=>store.get(key)};}};}}},async runTransaction(fn){const writes=[];const tx={get:ref=>ref.get(),set:(ref,data)=>writes.push([ref.key,data])};const out=await fn(tx);for(const [key,value] of writes)store.set(key,value);return out;}};
 return {db,store,request:(operation,extra={})=>modularStudentExamAction(db,{subjectId:'bio',operation,...extra},{role:'aluno',studentId:'aluna',uid:'uid'})};
}
test('sem ativação indevida: leitura antes da abertura não cria tentativa',async()=>{const h=harness('2026-11-08');const a=await h.request('read');assert.equal(a.status,'scheduled');assert.equal([...h.store.keys()].filter(x=>x.startsWith('se7EjaModularAttempts/')).length,0);});
test('rejeita usuário de outra matrícula',async()=>{const h=harness();await assert.rejects(()=>modularStudentExamAction(h.db,{subjectId:'bio'},{role:'aluno',studentId:'aluna',uid:'intruso'}),/Matrícula não autorizada/);});
