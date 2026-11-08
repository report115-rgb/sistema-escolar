import test from 'node:test';import assert from 'node:assert/strict';import {modularActivationCandidate} from '../server/eja-modular-payment.mjs';
const fixture={payment:{id:'pay1',status:'RECEIVED',paymentDate:'2026-11-08'},invoice:{id:'inv1',paymentId:'pay1',state:'linked'},link:{type:'eja-modular-first-payment',studentId:'stu1',invoiceId:'inv1',months:6},student:{id:'stu1',courseId:'c1'},course:{id:'c1',nivel:'Supletivo',ejaMode:'modular',ejaStage:'medio'}};
test('vínculo Asaas real permite ativação',()=>assert.equal(modularActivationCandidate(fixture).months,6));
test('fatura sem vínculo Asaas não ativa',()=>assert.equal(modularActivationCandidate({...fixture,invoice:{...fixture.invoice,state:'reserved'}}),null));
test('evento não pago não ativa',()=>assert.equal(modularActivationCandidate({...fixture,payment:{...fixture.payment,status:'PENDING'}}),null));
test('Prova Única permanece isolada',()=>assert.equal(modularActivationCandidate({...fixture,course:{...fixture.course,ejaMode:'single'}}),null));
