import {proposalState,overdueInvoice} from './se7-agreement-policy.js';
const E=(t,text)=>{const e=document.createElement(t);if(text!==undefined)e.textContent=text;return e;},today=()=>SE7Finance.dateISO(new Date()),model=()=>({students:typeof students==='undefined'?[]:students,logs:typeof financeLogs==='undefined'?[]:financeLogs});
const isOverdue=f=>!f.asaasReview&&!f.renegotiationLock&&!f.ejaManaged&&overdueInvoice(f,today(),SE7Finance.dateISO);
function debtors(){const {students,logs}=model(),map=new Map();for(const f of logs.filter(isOverdue)){const sid=f.studentId||f.alunoId,s=students.find(s=>s.id===sid);if(!s)continue;if(!map.has(sid))map.set(sid,{student:s,rows:[]});map.get(sid).rows.push(f);}return [...map.values()].sort((a,b)=>(a.student.fullname||'').localeCompare(b.student.fullname||'','pt-BR'));}
function button(text,fn){const b=E('button',text);b.type='button';b.className='se7-ren-button';b.onclick=async()=>{if(b.disabled)return;b.disabled=true;const old=b.textContent;b.textContent='Aguarde…';try{await fn();}catch(e){const d=document.createElement('dialog');d.className='se7-ren-dialog';d.append(E('p',e.message),button('Fechar',()=>d.close()));document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();}finally{b.disabled=false;b.textContent=old;}};return b;}
function names(s){const course=typeof coursesMap!=='undefined'?coursesMap[s.courseId]:null,group=typeof classesMap!=='undefined'?classesMap[s.classId]:null;return {course:typeof course==='string'?course:course?.name||s.courseName||s.course||s.curso||'Curso não informado',group:typeof group==='string'?group:group?.name||s.className||s.turma||'Turma não informada'};}

const statusOf=f=>String(f.status||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const proposal=f=>!!f.opcoesSalvas && ((f.id||'').startsWith('proposta_')||/PROPOSTA DE ACORDO/i.test(f.description||''));
const rejected=f=>/REPROV|RECUS|NEGAD/.test(statusOf(f));
const approved=f=>/ACORDO ACEITO|ACORDO EFETIVADO|EFETIVADO/.test(statusOf(f));
const processing=f=>/PROCESSAMENTO/.test(statusOf(f));
const pending=f=>proposal(f)&&!rejected(f)&&!approved(f)&&!processing(f);
const hasAsaasLink=(s,rows)=>!!(s.asaasCustomerId||s.asaasCustomer||s.asaasId||rows.some(f=>f.asaasPaymentId||f.asaasInvoiceId||f.asaasStatus||f.asaasCustomerId));
function eligibleDebtors(){
 const {logs}=model(),pendingIds=new Set(logs.filter(pending).map(f=>f.studentId||f.alunoId));
 return debtors().filter(r=>r.rows.length>=6&&!pendingIds.has(r.student.id)&&hasAsaasLink(r.student,r.rows));
}
function titleRow(text){const h=E('h3',text);h.className='font-bold text-xs uppercase text-emerald-600 dark:text-emerald-400 tracking-wider';return h;}
function proposalCard(f){
 const {students}=model(),s=students.find(s=>s.id===(f.studentId||f.alunoId))||{};
 const card=E('div');card.className='bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-emerald-500/50 space-y-2 text-xs mb-2';
 const identity=E('div');identity.className='mb-2';
 const name=E('strong',s.fullname||s.name||f.nomeAluno||'Aluno');name.className='block text-sm text-slate-900 dark:text-white';
 const course=E('p','Curso: '+names(s).course);course.className='text-[10px] text-slate-500';
 identity.append(name,course);card.append(identity);
 const top=E('div');top.className='flex justify-between items-center gap-2 flex-wrap';
 const desc=E('span',f.description||'Proposta de Acordo Consolidado');desc.className='font-bold text-slate-900 dark:text-white';
 const status=rejected(f)?'Proposta reprovada':approved(f)?'Acordo aceito':processing(f)?'Acordo em processamento':'Aguardando aprovação do aluno';
 const pill=E('span',status);pill.className='px-2 py-0.5 rounded-full text-[10px] font-bold '+(rejected(f)?'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300':approved(f)?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300':'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300');
 top.append(desc,pill);card.append(top);
 const value=E('div');value.className='text-[10px] text-slate-400';value.textContent='Valor Negociado Total: R$ '+(f.amount||f.valor||'0.00')+' • Data: '+SE7Finance.dateBR(f.date||f.vencimento);card.append(value);
 const actions=E('div');actions.className='flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800';
 const action=(label,css,fn)=>{const b=E('button',label);b.type='button';b.className='px-2.5 py-1 rounded-lg font-semibold text-[10px] text-white shadow '+css;b.onclick=async()=>{if(b.disabled)return;b.disabled=true;try{await fn();}catch(e){alert(e.message||'Não foi possível concluir.');}finally{b.disabled=false;}};actions.append(b);};
 action('Ver proposta','bg-slate-600 hover:bg-slate-700',()=>gerarPropostaPDF(f.id));
 if(approved(f)&&f.renegotiationId)action('Recuperar boletos','bg-cyan-700',()=>SE7Renegotiation.recover(f.renegotiationId,f.studentId||f.alunoId));
 if(rejected(f)) action('Excluir','bg-red-600 hover:bg-red-700',async()=>{if(!confirm('Excluir definitivamente esta proposta reprovada do histórico? Esta ação não pode ser desfeita.'))return;await db.collection('financeLogs').doc(f.id).delete();});
 if(pending(f)){
  action('Consultar acordo em andamento','bg-cyan-700',async()=>{const sid=f.studentId||f.alunoId;const result=await SE7.api('renegotiation-catalog',{studentId:sid});if(!result.active){alert('Nenhuma renegociação ativa localizada para este aluno.');return;}if(result.active.proposalId!==f.id)throw Error('A renegociação ativa não está vinculada a esta proposta. Solicite conferência antes de continuar.');await SE7Renegotiation.resume(result.active.id,sid);});
  action('Editar','bg-blue-600 hover:bg-blue-700',()=>{selecionarAlunoNegociacao(f.studentId||f.alunoId,true);abrirModalEditarProposta(f.id);});
  action('Excluir','bg-red-600 hover:bg-red-700',()=>excluirPropostaRegistro(f.id));
  action('Aprovar','bg-emerald-600 hover:bg-emerald-700',()=>{selecionarAlunoNegociacao(f.studentId||f.alunoId,true);abrirModalFecharAcordoParaProposta(f.id);});
  action('Reprovar','bg-amber-600 hover:bg-amber-700',async()=>{if(!confirm('Confirmar que o aluno recusou esta proposta?'))return;await db.collection('financeLogs').doc(f.id).update({status:'PROPOSTA RECUSADA',negadaEm:new Date().toISOString()});});
 }else if(processing(f)&&f.renegotiationId){
  action('Retomar efetivação','bg-emerald-600',()=>SE7Renegotiation.resume(f.renegotiationId,f.studentId||f.alunoId));
 }
 card.append(actions);return card;
}
let historyExpanded=false,overdueExpanded=false;
function refresh(){
 const host=document.getElementById('se7-negotiation-dashboard');if(!host)return;
 host.replaceChildren();
 const {logs}=model(),all=logs.filter(proposal),waiting=all.filter(f=>pending(f)||processing(f)),history=all.filter(f=>rejected(f)||approved(f));
 const first=E('section');first.className='space-y-2';first.append(titleRow('Propostas aguardando aprovação'));
 if(!waiting.length)first.append(E('p','Nenhuma proposta aguardando aprovação.'));
 for(const f of waiting)first.append(proposalCard(f));host.append(first);
 const archive=E('details'),archiveTitle=E('summary','Histórico de propostas ('+history.length+')');archive.className='bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2';archiveTitle.className='cursor-pointer font-bold text-xs text-slate-900 dark:text-white';archive.open=historyExpanded;archive.addEventListener('toggle',()=>{if(archive.isConnected)historyExpanded=archive.open;});archive.append(archiveTitle);
 if(!history.length)archive.append(E('p','Nenhuma proposta concluída.'));
 for(const f of history)archive.append(proposalCard(f));host.append(archive);
 const rows=eligibleDebtors(),overdue=E('details'),summary=E('summary','Alunos em atraso ('+rows.length+')');
 overdue.className='bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 space-y-2';
 summary.className='cursor-pointer font-bold text-xs text-slate-900 dark:text-white';overdue.open=overdueExpanded;overdue.addEventListener('toggle',()=>{if(overdue.isConnected)overdueExpanded=overdue.open;});overdue.append(summary);
 if(!rows.length)overdue.append(E('p','Nenhum aluno elegível para negociação.'));
 for(const r of rows){
  const s=r.student,n=names(s),card=E('div');card.className='bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-emerald-500/50 space-y-2 text-xs mb-2';
  const name=E('strong',s.fullname||s.name||'Aluno');name.className='block text-sm text-slate-900 dark:text-white';
  const details=E('p','Curso: '+n.course+' • '+r.rows.length+' mensalidades vencidas');details.className='text-[10px] text-slate-500';
  const b=E('button','Gerar proposta de acordo');b.type='button';b.className='px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-[10px] shadow';
  b.onclick=()=>{selecionarAlunoNegociacao(s.id,true);abrirModalRealizarAcordo();};
  card.append(name,details,b);overdue.append(card);
 }
 host.append(overdue);
 const badge=document.getElementById('se7-overdue-nav-badge');if(badge){badge.hidden=rows.length===0;badge.setAttribute('aria-label',rows.length+' aluno(s) elegível(is)');}
}

window.SE7Agreements={refresh,isOverdue,state:proposalState,hasOverdue:id=>eligibleDebtors().some(r=>r.student.id===id),isProposalOpen:()=>false,openOverdue:refresh,openProposal:id=>{const f=model().logs.find(f=>f.id===id);if(f&&proposal(f))gerarPropostaPDF(id);else refresh();}};refresh();let day=today();setInterval(()=>{if(day!==today()){day=today();refresh();}},60000);
