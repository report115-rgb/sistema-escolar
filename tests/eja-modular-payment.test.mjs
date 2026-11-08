import test from 'node:test';import assert from 'node:assert/strict';import {modularActivationCandidate} from '../server/eja-modular-payment.mjs';
const base={payment:{id:'pay1',status:'RECEIVED',paymentDate:'2026-11-08'},invoice:{id:'inv1',asaasPaymentId:'pay1',asaasStatus:'RECEIVED'},link:{type:'eja-modular-first-payment',studentId:'stu1',invoiceId:'inv1',months:6},student:{id:'stu1',courseId:'c1'},course:{id:'c1',nivel:'Supletivo',ejaMode:'modular',ejaStage:'medio'}};
test('pagamento modular vinculado produz ativação',()=>assert.equal(modularActivationCandidate(base).months,6));
test('pagamento não confirmado é ignorado',()=>assert.equal(modularActivationCandidate({...base,payment:{...base.payment,status:'PENDING'}}),null));
test('curso Prova Única não ativa',()=>assert.equal(modularActivationCandidate({...base,course:{...base.course,ejaMode:'single'}}),null));
test('vínculo divergente não ativa',()=>assert.equal(modularActivationCandidate({...base,link:{...base.link,studentId:'outro'}}),null));
test('fatura em revisão não ativa',()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,asaasReview:true}}),null));
