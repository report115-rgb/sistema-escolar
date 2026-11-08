// Auditoria pedagógica EJA Modular: 20 verificações de leitura, sem dados pessoais ou gabaritos.
const filled=x=>typeof x==='string'&&x.trim().length>0;
const https=x=>{try{const u=new URL(x);return u.protocol==='https:';}catch{return false;}};
export const MODULAR_AUDIT_RULES=Object.freeze([
 ['subject-id','Disciplina com identificador',({subject})=>filled(subject?.id)],
 ['subject-name','Disciplina com nome',({subject})=>filled(subject?.name||subject?.nome)],
 ['material-record','Registro de materiais criado',({materials})=>!!materials],
 ['syllabus','Ementa cadastrada',({materials})=>filled(materials?.ementa)],
 ['syllabus-length','Ementa dentro do limite',({materials})=>filled(materials?.ementa)&&materials.ementa.length<=12000],
 ['pdf-link','Apostila cadastrada',({materials})=>filled(materials?.apostilaUrl)],
 ['pdf-https','Apostila usa HTTPS',({materials})=>https(materials?.apostilaUrl)],
 ['pdf-size','Link da apostila dentro do limite',({materials})=>filled(materials?.apostilaUrl)&&materials.apostilaUrl.length<=2000],
 ['lessons-count','Três videoaulas cadastradas',({materials})=>Array.isArray(materials?.lessons)&&materials.lessons.length===3],
 ['lesson-1-title','Videoaula 1 com título',({materials})=>filled(materials?.lessons?.[0]?.title)],
 ['lesson-1-link','Videoaula 1 com HTTPS',({materials})=>https(materials?.lessons?.[0]?.url)],
 ['lesson-2-title','Videoaula 2 com título',({materials})=>filled(materials?.lessons?.[1]?.title)],
 ['lesson-2-link','Videoaula 2 com HTTPS',({materials})=>https(materials?.lessons?.[1]?.url)],
 ['lesson-3-title','Videoaula 3 com título',({materials})=>filled(materials?.lessons?.[2]?.title)],
 ['lesson-3-link','Videoaula 3 com HTTPS',({materials})=>https(materials?.lessons?.[2]?.url)],
 ['exam-record','Avaliação cadastrada',({exam})=>!!exam],
 ['exam-published','Avaliação publicada',({exam})=>exam?.published===true],
 ['exam-count','Dez questões cadastradas',({exam})=>Array.isArray(exam?.questions)&&exam.questions.length===10],
 ['exam-choices','Cinco alternativas por questão',({exam})=>Array.isArray(exam?.questions)&&exam.questions.length===10&&exam.questions.every(q=>Array.isArray(q.opcoes)&&q.opcoes.length===5&&q.opcoes.every(filled))],
 ['exam-answer-keys','Gabaritos válidos e enunciados completos',({exam})=>Array.isArray(exam?.questions)&&exam.questions.length===10&&exam.questions.every(q=>filled(q.enunciado)&&Number.isInteger(q.correta)&&q.correta>=0&&q.correta<=4)]
]);
export function auditModularSubject(subject,materials,exam){
 const context={subject,materials,exam};
 return MODULAR_AUDIT_RULES.map(([id,label,check])=>({id,label,ok:Boolean(check(context))}));
}
