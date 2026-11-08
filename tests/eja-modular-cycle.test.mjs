import test from 'node:test';import assert from 'node:assert/strict';
import {modularCyclePlan,modularDisciplineState} from '../server/eja-modular-cycle.mjs';
test('primeiro pagamento abre 3 disciplinas, provas no dia 27, novo ciclo no dia 30',()=>{
 const subjects=Array.from({length:9},(_,i)=>({id:'d'+i}));
 const plan=modularCyclePlan({subjects,months:3,firstPaymentConfirmedDate:'2027-01-31'});
 assert.deepEqual(plan.map(x=>x.cycle),[1,1,1,2,2,2,3,3,3]);
 assert.equal(plan[0].contentReleaseDate,'2027-01-31');
 assert.equal(plan[0].examEarliestDate,'2027-02-27');
 assert.equal(plan[3].contentReleaseDate,'2027-03-02');
 assert.equal(plan[3].examEarliestDate,'2027-03-29');
 assert.equal(plan[6].contentReleaseDate,'2027-04-01');
});
test('prova só elegível após dia 27 e comprovação de material e vídeo',()=>{
 const [discipline]=modularCyclePlan({subjects:[{id:'d'}],months:3,firstPaymentConfirmedDate:'2027-01-01'});
 assert.equal(modularDisciplineState({discipline,today:'2027-01-26',materialAccessed:true,videoCompleted:true}),'studying');
 assert.equal(modularDisciplineState({discipline,today:'2027-01-28',materialAccessed:true}),'requirements_pending');
 assert.equal(modularDisciplineState({discipline,today:'2027-01-28',materialAccessed:true,videoCompleted:true}),'exam_eligible');
 assert.equal(modularDisciplineState({discipline,today:'2027-01-29',examCompleted:true}),'completed');
});
test('9 meses com 9 disciplinas gera 9 ciclos; rejeita datas inválidas',()=>{
 const p=modularCyclePlan({subjects:Array.from({length:9},(_,i)=>({id:String(i)})),months:9,firstPaymentConfirmedDate:'2028-02-29'});
 assert.deepEqual(p.map(x=>x.cycle),[1,2,3,4,5,6,7,8,9]);
 assert.throws(()=>modularCyclePlan({subjects:[{id:'a'}],months:3,firstPaymentConfirmedDate:'2027-02-30'}),/Data inválida/);
});
