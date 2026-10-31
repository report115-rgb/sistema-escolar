import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../app-aluno.html',import.meta.url),'utf8');const script=readFileSync(new URL('../assets/se7-finance-notices.js',import.meta.url),'utf8');
test('aviso financeiro recorrente integrado ao portal',()=>{assert.match(page,/SE7FinanceNotices\\?\\.update/);assert.match(page,/SE7FinanceNotices\\?\\.navigation/);assert.match(page,/se7-finance-notices\\.js/);});
test('sem bloqueios pedagógicos e sem mensagem para aluno regular',()=>{assert.match(script,/if\\(!count\\)/);assert.match(script,/show\\(\\)/);assert.doesNotMatch(script,/disabled\\s*=\\s*true/);});
