import test from 'node:test';import assert from 'node:assert/strict';import {modularActivationCandidate} from '../server/eja-modular-payment.mjs';
const base={payment:{id:'pay1',status:'RECEIVED',paymentDate:'2026-11-08'},invoice:{id:'inv1',paymentId:'pay1',state:'linked',amountCents:30000,dueDate:'2026-11-10',payment:{status:'RECEIVED',paymentDate:'2026-11-08'}},link:{type:'eja-modular-first-payment',studentId:'stu1',courseId:'c1',invoiceId:'inv1',paymentId:'pay1',months:6,firstDueDate:'2026-11-10',firstInstallmentCents:30000},student:{id:'stu1',courseId:'c1'},course:{id:'c1',nivel:'Supletivo',ejaMode:'modular',ejaStage:'medio'}};
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

// Vinte cenários adicionais de regressão da ativação financeira.
test("parcela zero",()=>assert.equal(modularActivationCandidate({...base,link:{...base.link,firstInstallmentCents:0}}),null));
test("parcela fracionária",()=>assert.equal(modularActivationCandidate({...base,link:{...base.link,firstInstallmentCents:0.5}}),null));
test("vencimento divergente",()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,dueDate:'2026-11-11'}}),null));
test("fatura sem pagamento",()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,paymentId:null}}),null));
test("fatura sem status conciliado",()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,payment:{}}}),null));
test("fatura com estorno parcial",()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,partialRefund:true}}),null));
test("pagamento excluído",()=>assert.equal(modularActivationCandidate({...base,payment:{...base.payment,deleted:true}}),null));
test("pagamento estornado",()=>assert.equal(modularActivationCandidate({...base,payment:{...base.payment,refunded:true}}),null));
test("pagamento contestado",()=>assert.equal(modularActivationCandidate({...base,payment:{...base.payment,chargeback:true}}),null));
test("aluno de outro curso",()=>assert.equal(modularActivationCandidate({...base,student:{...base.student,courseId:'c2'}}),null));
test("tipo de vínculo incorreto",()=>assert.equal(modularActivationCandidate({...base,link:{...base.link,type:'other'}}),null));
test("vínculo de outro aluno",()=>assert.equal(modularActivationCandidate({...base,link:{...base.link,studentId:'other'}}),null));
test("vínculo de outra fatura",()=>assert.equal(modularActivationCandidate({...base,link:{...base.link,invoiceId:'other'}}),null));
test("prazo não permitido",()=>assert.equal(modularActivationCandidate({...base,link:{...base.link,months:12}}),null));
test("pagamento sem id",()=>assert.equal(modularActivationCandidate({...base,payment:{...base.payment,id:null}}),null));
test("data inexistente",()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,payment:{status:'RECEIVED',paymentDate:'2026-02-30'}}}),null));
test("data não ISO",()=>assert.equal(modularActivationCandidate({...base,invoice:{...base.invoice,payment:{status:'RECEIVED',paymentDate:'08/11/2026'}}}),null));
test("curso de etapa diferente",()=>assert.equal(modularActivationCandidate({...base,course:{...base.course,ejaStage:'fundamental'}}),null));
test("curso de nível diferente",()=>assert.equal(modularActivationCandidate({...base,course:{...base.course,nivel:'Tecnico'}}),null));
test("pagamento não confirmado",()=>assert.equal(modularActivationCandidate({...base,payment:{...base.payment,status:'OVERDUE'}}),null));
