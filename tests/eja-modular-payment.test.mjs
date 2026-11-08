import test from 'node:test';import assert from 'node:assert/strict';import {modularActivationCandidate} from '../server/eja-modular-payment.mjs';
const base={payment:{id:'pay1',status:'RECEIVED',paymentDate:'2026-11-08'},invoice:{id:'inv1',paymentId:'pay1',state:'linked',payment:{status:'RECEIVED',paymentDate:'2026-11-08'}},link:{type:'eja-modular-first-payment',studentId:'stu1',invoiceId:'inv1',months:6},student:{id:'stu1',courseId:'c1'},course:{id:'c1',nivel:'Supletivo',ejaMode:'modular',ejaStage:'medio'}};
test('conciliação Asaas e contrato permitem ativação',()=>assert.equal(modularActivationCandidate(base).months,6));
test('status divergente do registro conciliado bloqueia',()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,payment:{status:'PENDING'}}}),null));
test('fatura em revisão bloqueia',()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,state:'review'}}),null));
test('fatura substituída bloqueia',()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,superseded:true}}),null));
test('evento não pago bloqueia',()=>assert.equal(modularActivationCandidate({...base,payment:{...base.payment,status:'PENDING'}}),null));
test('curso Prova Única não ativa',()=>assert.equal(modularActivationCandidate({...base,course:{...base.course,ejaMode:'single'}}),null));
