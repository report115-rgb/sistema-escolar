import test from 'node:test';import assert from 'node:assert/strict';
import {importSingleExamQuestions,newModularExam,prepareModularExam,studentModularExam,gradeModularExam} from '../server/eja-modular-exams.mjs';
const question=i=>({enunciado:'Questão '+i,opcoes:['A','B','C','D','E'],correta:i%5});
const source={provasPorDisciplina:[{id:'bio',nome:'Biologia',questoes:Array.from({length:5},(_,i)=>question(i))}]};
test('importa por nome sem alterar a avaliação da Prova Única',()=>{
 const imported=importSingleExamQuestions(source,{subjectId:'nova-bio',subjectName:'biología'});
 assert.equal(imported.questions.length,5);
 imported.questions[0].enunciado='Editada no modular';
 assert.equal(source.provasPorDisciplina[0].questoes[0].enunciado,'Questão 0');
 assert.equal(imported.published,false);
});
test('exige dez questões válidas para publicar',()=>{
 const imported=importSingleExamQuestions(source,{subjectName:'Biologia'});
 assert.throws(()=>prepareModularExam(imported),/dez questões/);
 imported.questions.push(...Array.from({length:5},(_,i)=>question(i+5)));
 const ready=prepareModularExam(imported);
 assert.equal(ready.questions.length,10);
 assert.equal(ready.published,true);
 const shuffled=studentModularExam(ready,n=>n-1);
 assert.equal(shuffled.length,10);
 assert.equal(gradeModularExam(shuffled,Object.fromEntries(shuffled.map((q,i)=>[i,q.correta]))).approved,true);
 assert.equal(gradeModularExam(shuffled,{}).approved,false);
});
test('não importa disciplina ambígua e aceita cadastro manual',()=>{
 assert.throws(()=>importSingleExamQuestions({provasPorDisciplina:[...source.provasPorDisciplina,...source.provasPorDisciplina]},{subjectName:'Biologia'}),/duplicadas/);
 assert.equal(newModularExam({subjectId:'x',subjectName:'História'}).questions.length,0);
});
