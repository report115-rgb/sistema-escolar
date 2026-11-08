// Projeção somente leitura: reaproveita curso, turma e matrícula da Matriz.
// Não persiste cronograma, altera notas, libera provas nem emite cobranças.
import {MODULAR_DURATIONS,modularInstallments} from './eja-modular-plan.mjs';
import {modularCyclePlan} from './eja-modular-cycle.mjs';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const id=v=>String(v||'').trim();
export function modularStudentSnapshot({course,courseId,classroom,classId,student,startDate,totalCents}){
 if(!course||course.nivel!=='Supletivo'||course.ejaMode!=='modular')fail('Curso não pertence ao EJA Modular.');
 const months=student?.ejaDurationMonths;
 if(!MODULAR_DURATIONS.includes(months))fail('Plano modular não configurado.');
 if(course.ejaStage!=='medio')fail('O EJA Modular é exclusivo do Ensino Médio.');
 if(!id(courseId)||!id(classId)||!id(student?.id))fail('Identificação acadêmica incompleta.');
 if(id(classroom?.courseId)!==id(courseId)||id(student?.courseId)!==id(courseId)||id(student?.classId)!==id(classId))fail('Matrícula não pertence ao curso e turma informados.');
 if(id(student?.status)&&id(student.status)!=='Ativo')fail('Matrícula não está ativa.');
 const subjects=course.subjects;
 if(!Array.isArray(subjects)||!subjects.length)fail('Curso ainda não possui disciplinas.');
 const normalized=subjects.map((subject,index)=>({
  id:id(subject?.id),name:id(subject?.name||subject?.nome)||'Disciplina '+(index+1)
 }));
 const plan=modularCyclePlan({subjects:normalized,months,firstPaymentConfirmedDate:startDate});
 const installments=totalCents===undefined?null:modularInstallments(totalCents,months);
 return {
  courseId:id(courseId),classId:id(classId),studentId:id(student.id),
  stage:course.ejaStage,durationMonths:months,startDate,
  disciplines:plan.map((item,index)=>({...item,name:normalized[index].name})),
  financialPreviewCents:installments
 };
}
