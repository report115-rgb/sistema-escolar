// Banco de avaliações independente do EJA Modular.
// Importa por ID ou nome, sempre por cópia; nunca altera as provas da Prova Única.
import {randomizedQuestions} from './eja-policy.mjs';
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
const clone=v=>JSON.parse(JSON.stringify(v));
export const MODULAR_QUESTION_COUNT=10;
export function validateModularQuestion(q){
 if(!q||typeof q.enunciado!=='string'||!q.enunciado.trim()||q.enunciado.length>6000)fail('Enunciado inválido.');
 if(!Array.isArray(q.opcoes)||q.opcoes.length!==5||q.opcoes.some(o=>typeof o!=='string'||!o.trim()||o.length>3000))fail('Cada questão deve ter cinco alternativas completas.');
 if(!Number.isInteger(q.correta)||q.correta<0||q.correta>4)fail('Gabarito inválido.');
 if(q.imagem!==undefined&&q.imagem!==''&&!(typeof q.imagem==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,55000}$/.test(q.imagem)))fail('Imagem inválida.');
 return {enunciado:q.enunciado.trim(),opcoes:q.opcoes.map(x=>x.trim()),correta:q.correta,imagem:q.imagem||''};
}
export function validateModularDraftQuestion(q){
 if(!q||typeof q!=='object'||Array.isArray(q))fail('Questão inválida.');
 const enunciado=String(q.enunciado||'').trim();
 const opcoes=Array.isArray(q.opcoes)?q.opcoes:[];
 if(enunciado.length>6000||opcoes.length!==5||opcoes.some(x=>typeof x!=='string'||x.length>3000))fail('Questão ou alternativas inválidas.');
 const correta=Number(q.correta);
 if(!Number.isInteger(correta)||correta<0||correta>4)fail('Gabarito inválido.');
 const imagem=q.imagem||'';
 if(typeof imagem!=='string'||imagem&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]{1,55000}$/.test(imagem))fail('Imagem inválida.');
 return {enunciado,opcoes:opcoes.map(x=>x.trim()),correta,imagem};
}
export function importSingleExamQuestions(config,{subjectId,subjectName}={}){
 if(!subjectId&&!subjectName)fail('Informe a disciplina.');
 const groups=config?.provasPorDisciplina;
 if(!Array.isArray(groups))fail('Banco de avaliações da Prova Única indisponível.');
 const exact=groups.filter(g=>subjectId&&String(g.id)===String(subjectId));
 const matches=exact.length?exact:groups.filter(g=>norm(g.nome)===norm(subjectName)&&norm(subjectName));
 if(matches.length!==1)fail(matches.length?'Há avaliações duplicadas para esta disciplina.':'Avaliação da disciplina não encontrada na Prova Única.');
 const questions=matches[0].questoes;
 if(!Array.isArray(questions)||questions.length!==5)fail('A avaliação original precisa conter cinco questões.');
 return {source:'prova-unica-copy',sourceDisciplineId:String(matches[0].id||''),subjectId:String(subjectId||''),subjectName:String(subjectName||matches[0].nome||''),questions:questions.map(q=>clone(validateModularQuestion(q))),published:false};
}
export function newModularExam({subjectId,subjectName}={}){
 if(!String(subjectId||'').trim()||!String(subjectName||'').trim())fail('Disciplina inválida.');
 return {source:'manual',subjectId:String(subjectId),subjectName:String(subjectName),questions:[],published:false};
}
export function prepareModularExam(exam){
 if(!exam||!Array.isArray(exam.questions)||exam.questions.length!==MODULAR_QUESTION_COUNT)fail('A prova modular deve conter exatamente dez questões.');
 const questions=exam.questions.map((q,i)=>({...validateModularQuestion(q),disciplinaId:String(exam.subjectId||''),disciplinaNome:String(exam.subjectName||''),numero:i+1}));
 if(!questions[0].disciplinaId||!questions[0].disciplinaNome)fail('Disciplina inválida.');
 return {...clone(exam),questions,published:true};
}
export function studentModularExam(exam,randomIndex){
 if(exam?.published!==true)fail('Avaliação ainda não publicada.');
 const validated=prepareModularExam(exam);
 return randomizedQuestions(validated.questions,randomIndex);
}
export function gradeModularExam(questions,answers){
 if(!Array.isArray(questions)||questions.length!==10)fail('Avaliação inválida.');
 if(!answers||typeof answers!=='object'||Array.isArray(answers))fail('Respostas inválidas.');
 const correct=questions.reduce((n,q,i)=>n+(answers[String(i)]===q.correta?1:0),0);
 return {correct,total:10,grade:correct,approved:correct>=5};
}
