import test from 'node:test';import assert from 'node:assert/strict';import {modularActivationCandidate} from '../server/eja-modular-payment.mjs';
const base={payment:{id:'pay1',status:'RECEIVED',paymentDate:'2026-11-08'},invoice:{id:'inv1',paymentId:'pay1',state:'linked',amountCents:30000,payment:{status:'RECEIVED',paymentDate:'2026-11-08'}},link:{type:'eja-modular-first-payment',studentId:'stu1',courseId:'c1',invoiceId:'inv1',paymentId:'pay1',months:6,firstInstallmentCents:30000},student:{id:'stu1',courseId:'c1'},course:{id:'c1',nivel:'Supletivo',ejaMode:'modular',ejaStage:'medio'}};
test('ativação validada com vínculo completo',()=>assert.equal(modularActivationCandidate(base).months,6));
for(const [label,change] of [
 ['pagamento divergente',{link:{...base.link,paymentId:'other'}}],
 ['curso divergente',{link:{...base.link,courseId:'other'}}],
 ['valor divergente',{invoice:{...base.invoice,amountCents:29999}}],
 ['fatura em revisão',{invoice:{...base.invoice,state:'review'}}],
 ['status pendente',{payment:{...base.payment,status:'PENDING'}}],
 ['status financeiro divergente',{invoice:{...base.invoice,payment:{status:'PENDING'}}}],
 ['fatura substituída',{invoice:{...base.invoice,superseded:true}}],
 ['curso Prova Única',{course:{...base.course,ejaMode:'single'}}]
])test(label,()=>assert.equal(modularActivationCandidate({...base,...change}),null));
