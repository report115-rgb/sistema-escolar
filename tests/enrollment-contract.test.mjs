import test from 'node:test';
import assert from 'node:assert/strict';
import '../assets/se7-enrollment-contract.js';
import {fingerprint,eligible,issue,hash,verify} from '../server/academic-documents.mjs';
const M=globalThis.SE7EnrollmentContract;
const course={name:'Técnico em Enfermagem',nivel:'tecnico',hours:1800,qtdParcelas:99,vencimento:10};
const student={fullname:'Aluno <script>',code:'MAT-1',cpf:'123',status:'Ativo',courseId:'c',classId:'g',poloId:'p',enrollmentDate:'2026-10-19',entryStage:'2º semestre',academicEntry:{startDate:'2026-10-24'}};
const group={courseId:'c',poloId:'p',poloName:'Vigia',name:'NOME DA TURMA REMOVIDO',code:'ENF-001',entrySemester:'2026/1',semestre:'2026/2',stage:3,weekdays:[6],startTime:'08:00',endTime:'17:00',financeConfig:{qtdParcelas:17,vencimento:10,valorParcela:887.65}};
test('contrato usa cadastro real da turma, distingue ingresso individual e não imprime valores nem campos removidos',()=>{
 const x=M.snapshot(student,course,group,{name:'Instituição'});assert.equal(x.academic.studentEntrySemester,'2026/2');assert.equal(x.academic.classEntrySemester,'2026/1');assert.equal(x.finance.formationInstallments,17);assert.equal(x.finance.internshipInstallments,7);assert.equal(x.finance.totalInstallments,24);assert.equal(x.finance.firstDueDate,'20/10/2026');assert.equal(x.academic.entryStage,'2º semestre');assert.equal(x.academic.weekdays,'Sábado');
 const html=M.render(student,course,group,{name:'Instituição'});assert(html.includes('Aluno &lt;script&gt;'));assert(!html.includes('<script>'));for(const label of ['Endereço do polo','Nível e modalidade','Sigla do curso','Nome da turma','Etapa atual da turma','Turno de aula','NOME DA TURMA REMOVIDO','887.65','R$','Demonstração'])assert(!html.includes(label),label);
 assert(html.includes('ENF-001'));assert(html.includes('Horário de início e término'));
});
test('informação ausente não vira dado fictício nem parcelas deduzidas da duração',()=>{const x=M.snapshot({}, {name:'Técnico em Enfermagem'}, {}, {});assert.equal(x.finance.formationInstallments,null);assert.equal(x.finance.totalInstallments,null);assert.equal(x.academic.studentEntrySemester,'');assert.equal(x.academic.entryStage,'');assert(M.render({},course,{},{}).includes('Não informado no cadastro'));});
test('contrato padrão só atende enfermagem técnica e fica sensível a mudanças nos dados da turma',()=>{assert(M.supports(course));assert(!M.supports({name:'Graduação em Enfermagem',nivel:'graduacao'}));assert(!M.supports({name:'EJA',nivel:'supletivo'}));eligible('contrato',student,course);assert.throws(()=>eligible('contrato',student,{name:'EJA'}),/configurado/);assert.notEqual(fingerprint(student,course,group,{}),fingerprint(student,course,{...group,endTime:'18:00'},{}));assert.notEqual(fingerprint(student,course,group,{}),fingerprint(student,course,{...group,financeConfig:{...group.financeConfig,qtdParcelas:15}},{}));});
test('emissão guarda versão e fotografia privada dos dados sem expor cadastro na consulta pública',async()=>{
 const data=new Map([['students/s',student],['courses/c',course],['classes/g',group],['config/institution',{name:'Instituição'}]]);
 const db={collection:c=>({doc:id=>({key:c+'/'+id})}),runTransaction:fn=>fn({get:async r=>({exists:data.has(r.key),data:()=>data.get(r.key)}),set:(r,v)=>data.set(r.key,v)})};
 const b={studentId:'s',type:'contrato',requestId:'11111111-1111-4111-8111-111111111111',expectedFingerprint:hash(fingerprint(student,course,group,{name:'Instituição'})),contentHash:hash('contrato')};
 const result=await issue(db,b,{role:'master',uid:'master'});const saved=data.get('se7AcademicDocuments/'+result.token);assert.equal(saved.contractVersion,M.version);assert.equal(saved.contractSnapshot.academic.classCode,'ENF-001');group.endTime='19:00';assert.equal(saved.contractSnapshot.academic.time,'08:00 às 17:00');group.endTime='17:00';
 db.collection=c=>({doc:id=>({get:async()=>({exists:true,data:()=>data.get(c+'/'+id)})})});const publicData=await verify(db,{token:result.token});assert(!('contractSnapshot' in publicData));assert(!('cpf' in publicData));
});
