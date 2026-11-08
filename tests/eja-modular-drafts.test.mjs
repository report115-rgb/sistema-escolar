import test from 'node:test';import assert from 'node:assert/strict';
import {validateModularDraftQuestion,prepareModularExam} from '../server/eja-modular-exams.mjs';
const blank={enunciado:'',opcoes:['','','','',''],correta:0,imagem:''};
test('rascunho permite questões incompletas sem publicar',()=>{assert.deepEqual(validateModularDraftQuestion(blank),blank);assert.throws(()=>prepareModularExam({subjectId:'a',subjectName:'Arte',questions:[blank]}),/dez questões/);});
test('gabarito e imagem inválidos são rejeitados mesmo no rascunho',()=>{assert.throws(()=>validateModularDraftQuestion({...blank,correta:7}),/Gabarito/);assert.throws(()=>validateModularDraftQuestion({...blank,imagem:'http://example.com'}),/Imagem/);});
test('publicação exige dez questões completas',()=>{const questions=Array.from({length:10},(_,i)=>({...blank,enunciado:'Questão '+i,opcoes:['A','B','C','D','E']}));assert.equal(prepareModularExam({subjectId:'a',subjectName:'Arte',questions}).published,true);});
