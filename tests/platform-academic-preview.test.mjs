import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Regressão: portal-preview deve permanecer somente leitura no piloto comercial.
test('Matriz Teste autoriza apenas operações acadêmicas de visualização',()=>{
 const src=readFileSync(new URL('../server/platform-pilot.mjs',import.meta.url),'utf8');
 assert.match(src,/body\.action==='portal-preview'/);
 for(const operation of ['list','exam-results','exam-result','notices-feed','notices-open'])assert.ok(src.includes("'"+operation+"'"));
 assert.match(src,/!readOnly\.has\(body\.operation\)/);
 assert.doesNotMatch(src,/pilotAllowed=new Set\(\[[^\]]*'academic-document-issue'/);
});
