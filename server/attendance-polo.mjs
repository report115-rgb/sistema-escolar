import {validId} from './security.mjs';
import {assertStudent,requirePolo} from './polos.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function attendancePolo(db,b,u){
 if(!['master','secretaria'].includes(u.role))fail(403,'Lançamento restrito ao master e à secretaria.');
 const group=await db.collection('classes').doc(validId(b.classId)).get();
 if(!group.exists)fail(404,'Turma não encontrada. Atualize a chamada.');
 const g=group.data();if(!g.poloId)fail(409,'A turma está sem polo definido. Vincule a turma ao polo em Sistemas → Turmas.');
 assertStudent(u,g);await requirePolo(db,g.poloId);
 const teacher=await db.collection('teachers').doc(validId(b.teacherId)).get();
 if(!teacher.exists||!(teacher.data().poloIds||[]).includes(g.poloId))fail(403,'Vincule o professor ao polo da turma antes de registrar a chamada.');
 if(teacher.data().courseId&&teacher.data().courseId!==g.courseId)fail(409,'Professor vinculado a outro curso.');
 return g.poloId;
}
