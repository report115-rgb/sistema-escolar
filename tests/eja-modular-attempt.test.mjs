import test from 'node:test';import assert from 'node:assert/strict';
import {modularCyclePlan,modularExamWindow} from '../server/eja-modular-cycle.mjs';
import {publicAttempt} from '../server/eja-modular-attempt.mjs';
test('tentativa pública não revela questões nem gabaritos',()=>{const out=publicAttempt({status:'in_progress',answers:{'0':2},questions:[{correta:2}]});assert.equal(out.submittedCount,1);assert.equal(out.questions,undefined);assert.equal(out.grade,null);});
test('prazo do último ciclo encerra e reabre nunca',()=>{const plan=modularCyclePlan({subjects:[{id:'a'},{id:'b'}],months:3,firstPaymentConfirmedDate:'2027-01-01'});const last=plan[1];assert.equal(last.examCloseAt,'2027-02-24T23:59:59.999');assert.equal(modularExamWindow(last,'2027-02-25T03:00:00.000Z').expired,true);});
