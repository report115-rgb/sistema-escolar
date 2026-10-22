import {createHash,randomBytes} from 'node:crypto';
import {validId,docTypes} from './security.mjs';
import {assertStudent} from './polos.mjs';
import {attendanceRule} from '../assets/se7-attendance-rules.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const dig=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const grade=v=>v===null||v===undefined||String(v).trim()===''?NaN:Number(String(v).replace(',','.'));
async function context(db,id,u){
 const sid=validId(id),ss=await db.collection('students').doc(sid).get();if(!ss.exists)fail(404,'Aluno não encontrado.');
 const student={...ss.data(),id:ss.id};assertStudent(u,student);
 const [cs,gs,cal,links,evals]=await Promise.all([db.collection('courses').doc(validId(student.courseId)).get(),db.collection('classes').doc(validId(student.classId)).get(),db.collection('academicCalendars').where('classId','==',student.classId).get(),db.collection('se7InternshipAssignments').where('studentId','==',sid).limit(501).get(),db.collection('se7InternshipEvaluations').where('studentId','==',sid).limit(501).get()]);
 if(!cs.exists||!gs.exists||gs.data().courseId!==student.courseId)fail(409,'Curso ou turma inconsistentes.');
 if(cal.size>1500||links.size>500||evals.size>500)fail(409,'Registros acadêmicos extensos. Solicite conferência manual.');
 return {student,course:cs.data(),group:gs.data(),calendar:cal.docs.map(x=>x.data()),assignments:links.docs.map(d=>({...d.data(),id:d.id})),evaluations:evals.docs.map(d=>({...d.data(),id:d.id}))};
}
function evaluate(c){
 const {student:s,course,calendar}=c,issues=[],details=[];
 if(!norm(course.name).includes('tecnico')||!norm(course.name).includes('enfermagem'))issues.push('Este diploma é exclusivo do curso Técnico em Enfermagem.');
 if(!/^(concluid[oa]|formad[oa])$/.test(norm(s.status)))issues.push('A matrícula ainda não consta como concluída.');
 for(const key of docTypes){const d=s.documentos?.[key];if(norm(d?.status)!=='aprovado')issues.push('Documento obrigatório não aprovado: '+key.replaceAll('_',' ')+'.');}
 const subjects=course.subjects||[];
 if(!subjects.length)issues.push('Matriz curricular não configurada.');
 let completedHours=0,totalHours=0;
 for(const sub of subjects){
  const name=sub.teachingType==='tcc'?'TCC - '+String(sub.name||'Trabalho de Conclusão de Curso').replace(/^TCC\s*[-–—]\s*/i,''):sub.name||'Disciplina',hours=Number(sub.hours||0),isTCC=sub.teachingType==='tcc';if(isTCC){const g=s.grades?.[sub.id]||{},n=grade(g.final),passed=Number.isFinite(n)&&n>=7&&n<=10;if(!(hours>0))issues.push(name+': carga horária não configurada.');else {totalHours+=hours;if(passed)completedHours+=hours;}if(!passed)issues.push(name+': TCC obrigatório ainda não concluído ou aprovado.');details.push({name,hours:hours>0?hours:0,grade:Number.isFinite(n)?n:null,frequency:null,passed});continue;}if(!(hours>0)){issues.push(name+': carga horária não configurada.');continue;}totalHours+=hours;
  const g=s.grades?.[sub.id]||{},n=grade(g.final),isInternship=sub.teachingType==='internship';
  const stageLinks=isInternship?c.assignments.filter(a=>String(a.subjectId)===String(sub.id)):[];
  const approvals=isInternship?c.evaluations.filter(e=>stageLinks.some(a=>a.id===e.assignmentId)&&e.status==='final'&&norm(e.result)==='aprovado'&&Number(e.requiredMinutes)>0&&Number(e.validatedMinutes)>=Number(e.requiredMinutes)):[];
  const passed=(Number.isFinite(n)?n>=7&&n<=10:(isInternship&&approvals.length>0));
  if(!passed)issues.push(name+': nota final ou aprovação pendente.');
  else completedHours+=hours;
  if(isInternship){
   const activeLinks=stageLinks.filter(a=>a.active!==false);
   if(!activeLinks.length)issues.push(name+': sem vínculo ativo de estágio.');
   if(activeLinks.some(a=>!approvals.some(e=>e.assignmentId===a.id)))issues.push(name+': existe vínculo sem avaliação final aprovada e carga horária validada.');
   const minutes=approvals.filter(e=>activeLinks.some(a=>a.id===e.assignmentId)).reduce((sum,e)=>sum+Number(e.validatedMinutes||0),0);
   if(minutes<hours*60)issues.push(name+': carga horária de estágio validada inferior à carga curricular.');
  }else{
   const rule=attendanceRule(s,name,calendar),periods=rule.periods||[];
   if(rule.failed||periods.some(p=>p.failed))issues.push(name+': reprovação por frequência.');
   if(!periods.length||!periods.some(p=>p.total>0))issues.push(name+': frequência sem calendário/aulas registradas para conferência.');
   else if(periods.some(p=>p.present+p.absent<p.total))issues.push(name+': faltam registros de presença ou falta em aulas previstas.');
  }
  details.push({name,hours,grade:Number.isFinite(n)?n:null,frequency:isInternship?null:(attendanceRule(s,name,calendar).total?Math.round(100*attendanceRule(s,name,calendar).present/attendanceRule(s,name,calendar).total):null),passed});
 }
 const planned=Number(course.hours||0);if(planned>0&&completedHours<planned)issues.push('Carga horária concluída menor que a prevista para o curso.');
 if(!planned)issues.push('Carga horária total do curso não configurada.');
 return {eligible:issues.length===0,issues,details,totalHours,completedHours,courseHours:planned};
}
function localDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
async function verifiedCompletion(db,id,eligible){
 const ref=db.collection('se7DiplomaCompletionChecks').doc(id);
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref),old=snap.exists?snap.data():{};
  if(!eligible){if(old.eligible===true)tx.set(ref,{eligible:false,lastCheckedAt:new Date().toISOString()},{merge:true});return '';}
  if(old.eligible===true&&/^\d{4}-\d{2}-\d{2}$/.test(old.completionDate||''))return old.completionDate;
  const completionDate=localDate();
  tx.set(ref,{eligible:true,completionDate,lastCheckedAt:new Date().toISOString()},{merge:true});
  return completionDate;
 });
}
function registration(b){
 const val=(v,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
 const issueDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Belem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const data={book:val(b.book,40),sheet:val(b.sheet,40),recordNumber:val(b.recordNumber,40),sistec:val(b.sistec,90),registrationDate:val(b.registrationDate,10),issueDate,ceeAct:val(b.ceeAct,220)};
 if(!data.book||!data.sheet||!data.recordNumber||!data.sistec||!data.ceeAct)fail(400,'Preencha livro, folha, registro nº, SISTEC e ato/processo autorizativo CEE/PA.');
 for(const key of ['registrationDate','issueDate']){const v=data[key];if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+'T12:00:00Z')))fail(400,'Data de registro ou expedição inválida.');}
 if(data.registrationDate>data.issueDate)fail(400,'A data de registro não pode ser posterior à expedição.');
 return data;
}
export async function check(db,b,u){
 if(!['master','secretaria'].includes(u.role))fail(403,'Acesso restrito.');
 const c=await context(db,b.studentId,u),result=evaluate(c);
 const completionDate=await verifiedCompletion(db,c.student.id,result.eligible);
 const draft=await db.collection('se7DiplomaDrafts').doc(c.student.id).get();return {student:{id:c.student.id,name:c.student.fullname,code:c.student.code,course:c.course.name},result,completionDate,draft:draft.exists?draft.data().registration:null,reviewedAt:new Date().toISOString()};
}
export async function saveDraft(db,b,u){
 if(!['master','secretaria'].includes(u.role))fail(403,'Acesso restrito à secretaria.');
 const c=await context(db,b.studentId,u),reg=registration(b),now=new Date().toISOString();
 const ref=db.collection('se7DiplomaDrafts').doc(c.student.id);
 await ref.set({studentId:c.student.id,registration:reg,savedAt:now,savedBy:u.uid});
 return {saved:true,registration:reg,savedAt:now};
}
export async function authorize(db,b,u,auth,reauth){
 if(u.role!=='master'||!process.env.SE7_MASTER_UID||u.uid!==process.env.SE7_MASTER_UID)fail(403,'Somente a conta Master principal autoriza diplomas.');
 const password=b.password;if(typeof password!=='string'||password.length<8||password.length>128)fail(400,'Confirme sua senha.');
 const reg=registration(b);
 const c=await context(db,b.studentId,u),ev=evaluate(c);const draft=await db.collection('se7DiplomaDrafts').doc(c.student.id).get();if(!draft.exists||dig(draft.data().registration)!==dig(reg))fail(409,'Salve a escrituração antes de solicitar a autorização.');
 if(!ev.eligible)fail(409,'Pendências de conclusão: '+ev.issues.slice(0,5).join(' '));
 const completionDate=await verifiedCompletion(db,c.student.id,true);
 const account=await reauth(u.email,password);if(!account||account.localId!==u.uid)fail(403,'Senha do Master não confirmada.');
 const fingerprint=dig({student:c.student,course:c.course,group:c.group,calendar:c.calendar,assignments:c.assignments,evaluations:c.evaluations});
 const key=dig({id:c.student.id,reg,fingerprint}),ref=db.collection('se7DiplomaRegistrations').doc(c.student.id);
 return db.runTransaction(async tx=>{
  const [studentSnap,old,saved]=await Promise.all([tx.get(db.collection('students').doc(c.student.id)),tx.get(ref),tx.get(db.collection('se7DiplomaDrafts').doc(c.student.id))]);if(!saved.exists||dig(saved.data().registration)!==dig(reg))fail(409,'Escrituração alterada. Salve e confira novamente.');
  if(!studentSnap.exists||dig({...studentSnap.data(),id:studentSnap.id})!==dig(c.student))fail(409,'Dados do aluno mudaram. Faça nova conferência.');
  if(old.exists&&old.data().state==='issued')fail(409,'Diploma já emitido. Solicite procedimento de segunda via.');
  if(old.exists&&old.data().key===key&&old.data().state==='authorized')return {authorized:true,token:old.data().token,registration:old.data().registration,authorizedAt:old.data().authorizedAt,completionDate:old.data().completionDate||completionDate};
  const token=randomBytes(24).toString('hex'),authorizedAt=new Date().toISOString();
  tx.set(ref,{studentId:c.student.id,studentName:c.student.fullname,studentCode:c.student.code,courseName:c.course.name,state:'authorized',registration:reg,key,fingerprint,completionDate,authorizedAt,authorizedBy:u.uid,token});
  tx.set(db.collection('se7AcademicDocuments').doc(token),{token,type:'diploma_tecnico_enfermagem',title:'Diploma de Técnico em Enfermagem',studentId:c.student.id,studentName:c.student.fullname,studentCode:c.student.code,courseName:c.course.name,className:c.group.name||'',issuedAt:authorizedAt,department:'Secretaria Acadêmica',issuerUid:u.uid,issuerName:u.profile?.nome||u.email||u.uid,contentHash:key,revokedAt:null});
  return {authorized:true,token,registration:reg,authorizedAt,completionDate};
 });
}
export async function recordPrint(db,b,u){
 if(u.role!=='master'||!process.env.SE7_MASTER_UID||u.uid!==process.env.SE7_MASTER_UID)fail(403,'Somente a conta Master principal registra a emissão.');
 const id=validId(b.studentId),c=await context(db,id,u),ev=evaluate(c);if(!ev.eligible)fail(409,'Os requisitos do aluno deixaram de estar atendidos. Faça nova conferência.');
 const fp=dig({student:c.student,course:c.course,group:c.group,calendar:c.calendar,assignments:c.assignments,evaluations:c.evaluations});
 const ref=db.collection('se7DiplomaRegistrations').doc(id);
 return db.runTransaction(async tx=>{const [snap,student]=await Promise.all([tx.get(ref),tx.get(db.collection('students').doc(id))]);if(!student.exists||dig({...student.data(),id:student.id})!==dig(c.student))fail(409,'O cadastro mudou. Faça nova conferência.');if(!snap.exists||snap.data().fingerprint!==fp||snap.data().state!=='authorized'||snap.data().authorizedBy!==u.uid||snap.data().token!==b.token)fail(409,'Diploma não autorizado para impressão.');
  const printedAt=new Date().toISOString();tx.update(ref,{state:'issued',printedAt,printedBy:u.uid});return {ok:true,printedAt};
 });
}
