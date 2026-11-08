import test from 'node:test';import assert from 'node:assert/strict';
import {validateModularMaterials} from '../server/eja-modular-materials.mjs';
test('valida três videoaulas, ementa e apostila HTTPS',()=>{const value=validateModularMaterials({ementa:'Biologia',apostilaUrl:'https://example.org/apostila.pdf',lessons:[1,2,3].map(i=>({title:'Aula '+i,url:'https://example.org/video/'+i}))});assert.equal(value.lessons.length,3);assert.equal(value.lessons[2].number,3);});
test('rejeita quantidade incorreta e URLs inseguras',()=>{assert.throws(()=>validateModularMaterials({lessons:[]}),/três/);assert.throws(()=>validateModularMaterials({apostilaUrl:'javascript:alert(1)',lessons:[{},{},{}]}),/HTTPS/);});
