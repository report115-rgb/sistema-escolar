import test from 'node:test';
import assert from 'node:assert/strict';
import {modularStudentSnapshot} from '../server/eja-modular-snapshot.mjs';
const input=()=>({courseId:'c1',classId:'t1',course:{nivel:'Supletivo',ejaMode:'modular',ejaStage:'medio',ejaDurationMonths:3,subjects:[{id:'p',name:'Português'},{id:'m',name:'Matemática'},{id:'h',name:'História'}]},classroom:{courseId:'c1'},student:{id:'s1',courseId:'c1',classId:'t1',status:'Ativo'},startDate:'2027-01-31',totalCents:10000});
test('monta visão do aluno a partir do cadastro real sem modificar fontes',()=>{
 const data=input(),before=structuredClone(data),result=modularStudentSnapshot(data);
 assert.deepEqual(data,before);
 assert.deepEqual(result.disciplines.map(d=>d.releaseDate),['2027-01-31','2027-02-28','2027-03-31']);
 assert.deepEqual(result.financialPreviewCents,[3334,3333,3333]);
 assert.equal(result.disciplines[1].name,'Matemática');
});
test('não permite mistura de curso, turma, aluno ou prova única',()=>{
 for(const key of ['classroom','student','course']){
  const data=input();if(key==='classroom')data.classroom.courseId='outro';
  if(key==='student')data.student.classId='outra';
  if(key==='course')data.course.ejaMode='prova-unica';
  assert.throws(()=>modularStudentSnapshot(data));
 }
});
test('não calcula cobrança quando valor não informado e rejeita disciplina sem ID',()=>{
 const data=input();delete data.totalCents;
 assert.equal(modularStudentSnapshot(data).financialPreviewCents,null);
 data.course.subjects[0].id='';
 assert.throws(()=>modularStudentSnapshot(data),/Identificador/);
});
