import test from 'node:test';import assert from 'node:assert/strict';
import {modularStudentSnapshot} from '../server/eja-modular-snapshot.mjs';
const course={nivel:'Supletivo',ejaMode:'modular',ejaStage:'medio',subjects:Array.from({length:9},(_,i)=>({id:'d'+i,name:'Disciplina '+i}))};
const classroom={courseId:'curso'};
const student={id:'aluno',courseId:'curso',classId:'turma',status:'Ativo',ejaDurationMonths:3};
test('cronograma por aluno utiliza duração da matrícula e ciclos de 30 dias',()=>{
 const a=modularStudentSnapshot({course,courseId:'curso',classroom,classId:'turma',student,startDate:'2027-01-31'});
 assert.equal(a.durationMonths,3);assert.equal(a.disciplines[3].contentReleaseDate,'2027-03-02');
 const b=modularStudentSnapshot({course,courseId:'curso',classroom,classId:'turma',student:{...student,ejaDurationMonths:9},startDate:'2027-01-31'});
 assert.equal(b.durationMonths,9);assert.equal(b.disciplines[1].cycle,2);
});
test('sem duração válida, turma correta ou ensino médio não há cronograma',()=>{
 const args={course,courseId:'curso',classroom,classId:'turma',student,startDate:'2027-01-31'};
 assert.throws(()=>modularStudentSnapshot({...args,student:{...student,ejaDurationMonths:0}}),/Plano modular/);
 assert.throws(()=>modularStudentSnapshot({...args,course:{...course,ejaStage:'fundamental'}}),/Ensino Médio/);
 assert.throws(()=>modularStudentSnapshot({...args,classId:'outra'}),/Matrícula não pertence/);
});
