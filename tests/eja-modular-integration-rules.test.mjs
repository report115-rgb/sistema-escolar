import test from 'node:test';import assert from 'node:assert/strict';
import {ejaDiplomaEligibility} from '../server/eja-diploma-eligibility.mjs';
import {modularCyclePlan} from '../server/eja-modular-cycle.mjs';
const ok={complete:true,allPaid:true,allApproved:true,pendingCount:0};
test('diploma EJA exige simultaneamente as três condições completas',()=>{
 assert.equal(ejaDiplomaEligibility({finance:ok,academic:ok,documents:ok}).eligible,true);
 for(const field of ['finance','academic','documents']){
  const state={finance:ok,academic:ok,documents:ok,[field]:{...ok,pendingCount:1}};
  assert.equal(ejaDiplomaEligibility(state).eligible,false);
 }
 assert.equal(ejaDiplomaEligibility({finance:ok,academic:ok}).eligible,false);
});
test('aulas semanais e avaliação no dia 27 de cada ciclo',()=>{
 const p=modularCyclePlan({subjects:[{id:'a'},{id:'b'},{id:'c'}],months:3,firstPaymentConfirmedDate:'2027-01-01'});
 assert.deepEqual(p[0].lessons.map(l=>l.releaseDate),['2027-01-01','2027-01-08','2027-01-15']);
 assert.equal(p[0].examEarliestDate,'2027-01-28');
 assert.equal(p[1].contentReleaseDate,'2027-01-31');
});
