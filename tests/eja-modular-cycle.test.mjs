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

import {modularExamWindow} from '../server/eja-modular-cycle.mjs';
test('abre às 08h de Belém e fecha às 23h59 do dia anterior à próxima prova',()=>{const p=modularCyclePlan({subjects:[{id:'a'},{id:'b'},{id:'c'}],months:3,firstPaymentConfirmedDate:'2027-01-01'});assert.equal(p[0].examOpenAt,'2027-01-28T08:00:00');assert.equal(p[0].examCloseAt,'2027-02-26T23:59:59.999');assert.equal(modularExamWindow(p[0],'2027-01-28T10:59:59Z').open,false);assert.equal(modularExamWindow(p[0],'2027-01-28T11:00:00Z').open,true);assert.equal(modularExamWindow(p[0],'2027-02-27T02:59:59Z').open,true);assert.equal(modularExamWindow(p[0],'2027-02-27T03:00:00Z').expired,true);assert.equal(p[2].examCloseAt,null);});
test('provas no mesmo ciclo compartilham prazo e não encerram umas às outras',()=>{const p=modularCyclePlan({subjects:Array.from({length:9},(_,i)=>({id:'d'+i})),months:3,firstPaymentConfirmedDate:'2027-01-01'});assert.equal(p[0].examCloseAt,p[1].examCloseAt);assert.equal(p[1].examCloseAt,p[2].examCloseAt);assert.equal(p[3].examOpenAt,'2027-02-27T08:00:00');});
