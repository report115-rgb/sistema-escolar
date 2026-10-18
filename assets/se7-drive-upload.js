/* Shared document uploader: no successful registration without a confirmed Drive link. */
(()=>{'use strict';const inflight=new Set();
async function upload({student,file,typeName,typeId,url,database,course,group,poloName=''}){
 const key=student?.id+':'+typeId;if(inflight.has(key))throw Error('Este documento já está sendo enviado. Aguarde.');
 if(!student?.id||!student.code||!student.fullname)throw Error('Cadastro sem identificação ou matrícula. Solicite a conferência à secretaria.');
 if(file?.type!=='application/pdf')throw Error('O documento precisa estar em PDF.');if(file.size>10485760)throw Error('Envie um PDF de até 10 MB.');
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(String(url||'').trim()))throw Error('A integração com o Drive precisa ser conferida pela instituição.');
 inflight.add(key);try{
  if(!course&&student.courseId){const d=await database.collection('courses').doc(student.courseId).get();if(d.exists)course={...d.data(),id:d.id};}
  if(!group&&student.classId){const d=await database.collection('classes').doc(student.classId).get();if(d.exists)group={...d.data(),id:d.id};}
  if(!student.courseId||!course?.name)throw Error('Curso não identificado. Solicite a conferência à secretaria.');
  if(student.classId&&!group?.name)throw Error('Turma não identificada. Solicite a conferência à secretaria.');
  const arquivoBase64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Não foi possível ler o PDF.'));r.readAsDataURL(file);});
  const payload={studentId:student.id,nomeAluno:student.fullname,matriculaAluno:student.code,courseId:student.courseId,nomeCurso:course.name,classId:student.classId||'',nomeTurma:group?.name||'Sem turma definida',poloId:group?.poloId||student.poloId||'',nomePolo:poloName||student.poloName||'',tipoDocumento:typeId,nomeDocumento:typeName,arquivoBase64,mimeType:'application/pdf'};
  const response=await fetch(url.trim(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
  let result;try{result=await response.json();}catch{throw Error('O Drive não confirmou o envio. Tente novamente; o sistema reutilizará a pasta do aluno.');}
  if(!response.ok||result.status!=='sucesso'||!/^https:\/\/(drive|docs)\.google\.com\//.test(result.fileUrl||''))throw Error(result.mensagem||'O Drive não confirmou o envio. Tente novamente.');
  return result;
 }finally{inflight.delete(key);}
}
window.SE7DriveUpload={upload};})();
