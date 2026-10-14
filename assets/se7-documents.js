/* Fila de documentação: recebe atualizações da escuta Firestore já existente no Matriz. */
const documentosAnalisadosNaTela = new Map();
let alunoDocumentosNaTela = '';
let documentosFingerprintNaTela = '';
const analisesDocumentosEmCurso = new Set();
const estiloAlertaDocumentos = document.createElement('style');
estiloAlertaDocumentos.textContent = `
.se7-docs-badge{position:absolute;top:-7px;right:-5px;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-size:14px;font-weight:800;color:white;border:2px solid #06172d;animation:se7-docs-alerta 1.6s ease-in-out infinite;}
.se7-docs-badge[hidden]{display:none;}
@keyframes se7-docs-alerta{0%,100%{background:#dc2626;box-shadow:0 0 5px #ef4444;opacity:1;}50%{background:#0875ff;box-shadow:0 0 12px #2995ff;opacity:.75;}}
@media(prefers-reduced-motion:reduce){.se7-docs-badge{animation:none;background:#dc2626;}}
`;
document.head.append(estiloAlertaDocumentos);
function podeRevisarDocumentos(){const u=JSON.parse(sessionStorage.getItem('usuario_logado')||'{}');return ['master','secretaria'].includes(u.perfil);}
function assinaturaEnvioDocumento(info){return JSON.stringify([info?.submissionId||'',info?.submittedAt||'',info?.driveUrl||'',info?.fileUrl||'',info?.fileName||'']);}
function documentoFoiEnviado(info){return !!(info&&(info.submissionId||info.fileName||info.driveUrl||info.fileUrl));}
function resumoDocumentosAluno(aluno){const pendentes=[],reprovados=[];for(const tipo of tiposDocumentosObrigatorios){const info=aluno.documentos?.[tipo.id];if(info?.status==='Reprovado')reprovados.push({tipo,info});else if(documentoFoiEnviado(info)&&info.status!=='Aprovado')pendentes.push({tipo,info});}return {aluno,pendentes,reprovados};}
function obterFilaDocumentos(){return students.map(resumoDocumentosAluno).filter(item=>item.pendentes.length||item.reprovados.length).sort((a,b)=>(Number(b.pendentes.length>0)-Number(a.pendentes.length>0))||(a.aluno.fullname||'').localeCompare(b.aluno.fullname||'','pt-BR'));}
function atualizarFilaDocumentos(){
 const fila=obterFilaDocumentos(),count=fila.reduce((total,item)=>total+item.pendentes.length,0),badge=document.getElementById('badge-documentos-pendentes');
 if(badge){badge.hidden=!count;badge.setAttribute('aria-label',count+' documento(s) aguardando análise');badge.title=count+' documento(s) aguardando análise';}
 const el=document.getElementById('fila-validacao-documentos'),resumo=document.getElementById('resumo-fila-documentos');
 if(resumo)resumo.textContent=fila.length?fila.length+' aluno(s) na lista • '+count+' documento(s) aguardando análise.':'Nenhum documento enviado aguardando análise ou reprovado.';
 if(el){el.replaceChildren();for(const item of fila){const box=document.createElement('div');box.className='p-4 rounded-xl border border-gray-300 dark:border-slate-600 space-y-2';const name=document.createElement('p');name.className='font-semibold text-sm';name.textContent=item.aluno.fullname+' ('+(item.aluno.code||'Sem matrícula')+')';box.append(name);
 if(item.pendentes.length){const p=document.createElement('p');p.className='text-xs text-blue-600 dark:text-blue-400';p.textContent=item.pendentes.length+' documento(s) aguardando análise';box.append(p);}
 if(item.reprovados.length){const p=document.createElement('p');p.className='text-xs text-red-600 dark:text-red-400';p.textContent='Documentação não aprovada pela secretaria';box.append(p);for(const rejeicao of item.reprovados){const why=document.createElement('p');why.className='text-xs';why.textContent=rejeicao.tipo.label+': '+(rejeicao.info.motivoReprovacao||'Motivo não informado.');box.append(why);}}
 const button=document.createElement('button');button.type='button';button.textContent='Verificar documentação';button.className='px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold';button.onclick=()=>{const select=document.getElementById('select-aluno-validacao');if(select)select.value=item.aluno.id;renderizarDocumentosAlunoGestao(item.aluno.id);document.getElementById('container-validacao-docs').scrollIntoView({block:'start',behavior:'auto'});};box.append(button);el.append(box);}}
 const atual=students.find(s=>s.id===alunoDocumentosNaTela);
 if(atual&&JSON.stringify(atual.documentos||{})!==documentosFingerprintNaTela)renderizarDocumentosAlunoGestao(atual.id);
 if(alunoDocumentosNaTela&&!atual)renderizarDocumentosAlunoGestao('');
}
function linkSeguroDocumento(info){for(const value of [info?.driveUrl,info?.fileUrl]){if(typeof value!=='string'||!value)continue;try{const url=new URL(value);if(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))return url.href;}catch{}}return '';}
function renderizarDocumentosAlunoGestao(alunoId){
 const container=document.getElementById('container-validacao-docs');if(!container)return;container.replaceChildren();alunoDocumentosNaTela=alunoId||'';const aluno=students.find(s=>s.id===alunoId);documentosFingerprintNaTela=JSON.stringify(aluno?.documentos||{});
 if(!aluno){container.textContent='Clique em Verificar documentação para analisar os arquivos enviados.';return;}
 const title=document.createElement('h3');title.className='font-bold text-sm';title.textContent='Documentação de '+aluno.fullname;container.append(title);
 for(const tipo of tiposDocumentosObrigatorios){const info=aluno.documentos?.[tipo.id],enviado=documentoFoiEnviado(info),status=info?.status||(enviado?'Pendente':'Não enviado'),url=linkSeguroDocumento(info);documentosAnalisadosNaTela.set(alunoId+'/'+tipo.id,assinaturaEnvioDocumento(info));
 const box=document.createElement('div');box.className='bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-700 space-y-2';const header=document.createElement('p');header.className='font-semibold text-xs';header.textContent=tipo.label+' — '+status;box.append(header);
 if(url){const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.className='text-xs text-blue-600 dark:text-blue-400 underline';link.textContent='Abrir arquivo: '+(info.fileName||tipo.label);box.append(link);}else{const note=document.createElement('p');note.className='text-xs text-gray-500';note.textContent=enviado?'O envio não possui um link de arquivo válido. Solicite o reenvio ao aluno.':'Documento ainda não enviado.';box.append(note);}
 if(status==='Reprovado'){const reason=document.createElement('p');reason.className='text-xs text-red-600 dark:text-red-400';reason.textContent='Motivo da reprovação: '+(info.motivoReprovacao||'Não informado.');box.append(reason);}
 if(enviado&&status!=='Aprovado'&&podeRevisarDocumentos()){
  const actions=document.createElement('div');actions.className='flex gap-2 pt-2';const approve=document.createElement('button');approve.type='button';approve.textContent='Aprovar documento';approve.className='px-3 py-2 bg-emerald-600 text-white rounded text-xs';approve.disabled=!url;approve.onclick=()=>aprovarEEnviarParaGoogleDrive(alunoId,tipo.id);if(!url){approve.style.opacity='.5';approve.title='É necessário um arquivo acessível para aprovar.';}const reject=document.createElement('button');reject.type='button';reject.textContent='Reprovar';reject.className='px-3 py-2 bg-red-600 text-white rounded text-xs';reject.onclick=()=>toggleBoxReprovacao(tipo.id);actions.append(approve,reject);box.append(actions);
  const rejection=document.createElement('div');rejection.id='box_reprov_'+tipo.id;rejection.style.display=status==='Reprovado'?'block':'none';const label=document.createElement('label');label.className='block text-xs mt-2';label.textContent='Motivo da reprovação';label.htmlFor='motivo_'+tipo.id;const input=document.createElement('input');input.type='text';input.id='motivo_'+tipo.id;input.value=info?.motivoReprovacao||'';input.className='w-full px-3 py-2 rounded border text-xs dark:bg-slate-800';input.maxLength=2000;const save=document.createElement('button');save.type='button';save.textContent='Salvar reprovação e motivo';save.className='px-3 py-2 bg-red-600 text-white rounded text-xs mt-2';save.onclick=()=>salvarReprovacaoDocumento(alunoId,tipo.id);rejection.append(label,input,save);box.append(rejection);
 }
 if(info?.reviewHistory?.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Histórico de análises';summary.className='text-xs cursor-pointer';details.append(summary);for(const review of [...info.reviewHistory].reverse()){const p=document.createElement('p');p.className='text-xs mt-2';p.textContent=review.status+' — '+(review.motivo||'Sem ressalvas')+' — '+(review.reviewedBy?.name||'Secretaria')+' — '+(review.reviewedAt?new Date(review.reviewedAt).toLocaleString('pt-BR'):'Data não registrada');details.append(p);}box.append(details);}
 container.append(box);
 }
}
function toggleBoxReprovacao(tipoId){const box=document.getElementById('box_reprov_'+tipoId);if(box)box.style.display=box.style.display==='none'?'block':'none';}
async function gravarAnaliseDocumento(alunoId,tipoId,status,motivo=''){
 if(!podeRevisarDocumentos())throw Error('Acesso restrito ao master ou secretaria.');
 if(!tiposDocumentosObrigatorios.some(t=>t.id===tipoId)||!['Aprovado','Reprovado'].includes(status))throw Error('Análise inválida.');
 if(status==='Reprovado'&&!motivo.trim())throw Error('Informe o motivo da reprovação.');
 if(motivo.length>2000)throw Error('O motivo deve ter até 2000 caracteres.');
 const local=students.find(s=>s.id===alunoId)?.documentos?.[tipoId];const expected=documentosAnalisadosNaTela.get(alunoId+'/'+tipoId)||assinaturaEnvioDocumento(local);const ref=db.collection('students').doc(alunoId);
 const user=(typeof sessaoRealMatriz!=='undefined'&&sessaoRealMatriz)||JSON.parse(sessionStorage.getItem('usuario_logado')||'{}');const reviewer={uid:firebase.auth().currentUser.uid,name:user.nome||user.email||'Secretaria',role:user.perfil};
 return db.runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw Error('Aluno não encontrado.');const current=snap.data().documentos?.[tipoId];if(!documentoFoiEnviado(current))throw Error('Documento não enviado.');if(assinaturaEnvioDocumento(current)!==expected)throw Error('O aluno enviou uma nova versão. Atualize e confira o arquivo antes de analisar.');if(current.status==='Aprovado')throw Error('Este documento já foi aprovado.');if(status==='Aprovado'&&!linkSeguroDocumento(current))throw Error('Não é possível aprovar um envio sem arquivo acessível.');
 const reviewedAt=new Date().toISOString(),review={status,motivo:status==='Reprovado'?motivo.trim():'',reviewedAt,reviewedBy:reviewer,submissionId:current.submissionId||'',fileName:current.fileName||'',url:current.driveUrl||current.fileUrl||''};
 const info={...current,status,motivoReprovacao:review.motivo,reviewedAt,reviewedBy:reviewer,reviewHistory:[...(Array.isArray(current.reviewHistory)?current.reviewHistory:[]),review]};tx.update(ref,{['documentos.'+tipoId]:info});return info;});
}
async function atualizarStatusDocumento(alunoId,tipoId,status,motivo=''){
 const key=alunoId+'/'+tipoId;if(analisesDocumentosEmCurso.has(key))return;analisesDocumentosEmCurso.add(key);
 try{const info=await gravarAnaliseDocumento(alunoId,tipoId,status,motivo);const aluno=students.find(s=>s.id===alunoId);if(aluno){aluno.documentos=aluno.documentos||{};aluno.documentos[tipoId]=info;}atualizarFilaDocumentos();renderizarDocumentosAlunoGestao(alunoId);if(typeof registrarLogAuditoria==='function')void registrarLogAuditoria(status+' documento '+tipoId+' de '+(aluno?.fullname||alunoId),'Validação de Documentos');alert('Documento '+status.toLowerCase()+' com sucesso.');}
 catch(e){alert(e.message||'Não foi possível salvar a análise.');}finally{analisesDocumentosEmCurso.delete(key);}
}
async function aprovarEEnviarParaGoogleDrive(alunoId,tipoId){await atualizarStatusDocumento(alunoId,tipoId,'Aprovado');}
async function salvarReprovacaoDocumento(alunoId,tipoId){const motivo=document.getElementById('motivo_'+tipoId)?.value.trim()||'';if(!motivo)return alert('Informe o motivo da reprovação.');await atualizarStatusDocumento(alunoId,tipoId,'Reprovado',motivo);}
