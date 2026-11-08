import test from 'node:test';import assert from 'node:assert/strict';import {studentModularAccess} from '../server/eja-modular-student.mjs';
const course={id:'c1',nivel:'Supletivo',ejaMode:'modular',ejaStage:'medio'};
test('sem confirmação autenticada não ativa curso',()=>{const s={courseId:'c1',ejaModularActivation:{confirmed:true,source:'manual',months:3,firstPaymentConfirmedDate:'2026-11-08',paymentId:'abc'}};assert.equal(studentModularAccess(s,course).active,false);});
test('curso de outro aluno é proibido',()=>assert.throws(()=>studentModularAccess({courseId:'outro'},course),/Matrícula/));
test('ativação autenticada com prazo válido é reconhecida',()=>{const s={courseId:'c1',ejaModularActivation:{confirmed:true,source:'asaas-webhook-confirmed',months:6,firstPaymentConfirmedDate:'2026-11-08',paymentId:'pay_1'}};assert.equal(studentModularAccess(s,course).active,true);});
test('duração inválida permanece bloqueada',()=>{const s={courseId:'c1',ejaModularActivation:{confirmed:true,source:'asaas-webhook-confirmed',months:5,firstPaymentConfirmedDate:'2026-11-08',paymentId:'pay_1'}};assert.equal(studentModularAccess(s,course).active,false);});
