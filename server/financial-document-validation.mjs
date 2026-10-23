import {randomBytes} from 'node:crypto';
const error=(status,message)=>{throw Object.assign(new Error(message),{status});};
const valid=v=>typeof v==='string'&&/^proposta_[A-Za-z0-9_-]{1,160}$/.test(v);
export async function issue(db,b,u){
 if(!['master','financeiro'].includes(u.role))error(403,'Acesso restrito ao Financeiro.');
 if(!valid(b.proposalId))error(400,'Proposta inválida.');
 const ref=db.collection('financeLogs').doc(b.proposalId),proposal=await ref.get();
 if(!proposal.exists)error(404,'Proposta não localizada.');
 const p=proposal.data(),sid=p.studentId||p.alunoId;
 if(!/ACORDO ACEITO|ACORDO EFETIVADO|EFETIVADO/i.test(String(p.status||''))||!p.renegotiationId||!sid||!p.modalidadeAceita)error(409,'Acordo não está efetivado.');
 const [agreement,student,institution]=await Promise.all([db.collection('se7Renegotiations').doc(p.renegotiationId).get(),db.collection('students').doc(sid).get(),db.collection('config').doc('institution').get()]);
 if(!agreement.exists||agreement.data().state!=='done'||agreement.data().studentId!==sid||!student.exists)error(409,'Renegociação não confirmada.');
 const g=agreement.data(),amount=Number(p.valorAceitoCents);
 if(!Number.isSafeInteger(amount)||amount<=0||amount!==g.offer.total||g.offer.count!==g.installments.length)error(409,'Valores do acordo divergentes.');
 const code=randomBytes(24).toString('hex'),doc=db.collection('se7FinancialAgreementDocuments');
 return db.runTransaction(async tx=>{
  const latest=await tx.get(ref);
  if(!latest.exists||latest.data().renegotiationId!==p.renegotiationId||!/ACORDO ACEITO|ACORDO EFETIVADO|EFETIVADO/i.test(latest.data().status||''))error(409,'Proposta alterada.');
  const token=latest.data().validationToken||code;
  if(!/^[a-f0-9]{48}$/.test(token))error(409,'Código anterior inválido.');
  if(!latest.data().validationToken){
   const s=student.data(),ins=institution.data()||{};
   tx.create(doc.doc(token),{token,proposalId:b.proposalId,renegotiationId:p.renegotiationId,studentId:sid,studentName:s.fullname||s.name||'',studentCode:s.code||s.matricula||'',courseName:s.courseName||s.curso||s.course||'',institutionName:ins.name||ins.razao||'',institutionCNPJ:ins.cnpj||'',amountCents:amount,count:g.offer.count,method:g.offer.method,acceptedAt:p.aceitoEm||p.efetivadoEm||g.completedAt||'',issuedAt:new Date().toISOString(),revokedAt:null});
   tx.update(ref,{validationToken:token,validationIssuedAt:new Date().toISOString()});
  }
  return {token,url:'https://sistema-escolar-ten-mu.vercel.app/validar-acordo.html#'+token};
 });
}
export async function verify(db,b){
 const token=String(b.token||'');if(!/^[a-f0-9]{48}$/.test(token))error(400,'Código de validação inválido.');
 const doc=await db.collection('se7FinancialAgreementDocuments').doc(token).get();if(!doc.exists)return {found:false,valid:false};
 const v=doc.data(),p=await db.collection('financeLogs').doc(v.proposalId).get();
 const valid=!!p.exists&&!v.revokedAt&&p.data().validationToken===token&&p.data().renegotiationId===v.renegotiationId&&/ACORDO ACEITO|ACORDO EFETIVADO|EFETIVADO/i.test(p.data().status||'');
 return {found:true,valid,title:'Declaração de Aceite de Acordo Financeiro',studentName:v.studentName,studentCode:v.studentCode,institutionName:v.institutionName,institutionCNPJ:v.institutionCNPJ,amountCents:v.amountCents,count:v.count,acceptedAt:v.acceptedAt,issuedAt:v.issuedAt,code:token};
}
