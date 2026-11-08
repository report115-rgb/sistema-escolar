import test from 'node:test';
import assert from 'node:assert/strict';
import {modularInstallments,modularReleaseDate,planModularSubjects} from '../server/eja-modular-plan.mjs';
test('parcelamento modular conserva centavos sem gerar cobranças',()=>{
 for(const months of [3,6,9]){const parts=modularInstallments(140003,months);assert.equal(parts.length,months);assert.equal(parts.reduce((a,b)=>a+b,0),140003);assert(Math.max(...parts)-Math.min(...parts)<=1);}
 assert.throws(()=>modularInstallments(100,4),/Duração/);
});
test('datas mensais preservam dia e ajustam finais de mês',()=>{
 assert.equal(modularReleaseDate('2027-01-31',1),'2027-02-28');
 assert.equal(modularReleaseDate('2028-01-31',1),'2028-02-29');
 assert.equal(modularReleaseDate('2027-01-31',2),'2027-03-31');
 assert.throws(()=>modularReleaseDate('2027-02-30',0),/inválida/);
});
test('cronograma determinístico mantém a ordem e não altera disciplinas',()=>{
 const subjects=Array.from({length:12},(_,i)=>({id:'d'+i,name:'Disciplina '+i}));
 const original=structuredClone(subjects);
 const plan=planModularSubjects({subjects,months:6,startDate:'2027-01-15'});
 assert.deepEqual(subjects,original);
 assert.equal(plan.length,12);
 assert.deepEqual(plan.map(p=>p.monthIndex),[1,1,2,2,3,3,4,4,5,5,6,6]);
 assert.equal(plan[2].releaseDate,'2027-02-15');
 assert.throws(()=>planModularSubjects({subjects:[{id:'x'},{id:'x'}],months:3,startDate:'2027-01-15'}),/repetido/);
});
