import test from 'node:test';import assert from 'node:assert/strict';import {modularAcademicMonitorAction} from '../server/eja-modular-monitor.mjs';
test('monitoramento nega consulta a usuário sem permissão',async()=>{await assert.rejects(()=>modularAcademicMonitorAction({}, {courseId:'c',studentId:'s'}, {role:'aluno'}),/Acesso restrito/);});
