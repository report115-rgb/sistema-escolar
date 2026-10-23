import {proposalState,overdueInvoice} from './se7-agreement-policy.js';
const E=(t,text)=>{const e=document.createElement(t);if(text!==undefined)e.textContent=text;return e;},today=()=>SE7Finance.dateISO(new Date()),model=()=>({students:typeof students==='undefined'?[]:students,logs:typeof financeLogs==='undefined'?[]:financeLogs});
const isOverdue=f=>!f.asaasReview&&!f.renegotiationLock&&!f.ejaManaged&&overdueInvoice(f,today(),SE7Finance.dateISO);
function debtors(){const {students,logs}=model(),map=new Map();for(const f of logs.filter(isOverdue)){const sid=f.studentId||f.alunoId,s=students.find(s=>s.id===sid);if(!s)continue;if(!map.has(sid))map.set(sid,{student:s,rows:[]});map.get(sid).rows.push(f);}return [...map.values()].sort((a,b)=>(a.student.fullname||'').localeCompare(b.student.fullname||'','pt-BR'));}
function button(text,fn){const b=E('button',text);b.type='button';b.className='se7-ren-button';b.onclick=async()=>{if(b.disabled)return;b.disabled=true;const old=b.textContent;b.textContent='Aguarde…';try{await fn();}catch(e){const d=document.createElement('dialog');d.className='se7-ren-dialog';d.append(E('p',e.message),button('Fechar',()=>d.close()));document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();}finally{b.disabled=false;b.textContent=old;}};return b;}
function names(s){const course=typeof coursesMap!=='undefined'?coursesMap[s.courseId]:null,group=typeof classesMap!=='undefined'?classesMap[s.classId]:null;return {course:typeof course==='string'?course:course?.name||s.courseName||s.course||s.curso||'Curso não informado',group:typeof group==='string'?group:group?.name||s.className||s.turma||'Turma não informada'};}
function refresh(){
 const host=document.getElementById('se7-negotiation-dashboard');if(!host)return;
 host.replaceChildren();const {students,logs}=model(),rows=debtors();
 const proposals=logs.filter(f=>f.opcoesSalvas&&((f.id||'').startsWith('proposta_')||/PROPOSTA DE ACORDO/i.test(f.description||'')));
 const heading=E('h3','Propostas de acordo — acompanhamento');host.append(heading);
 if(!proposals.length)host.append(E('p','Nenhuma proposta registrada.'));
 for(const f of proposals){
  const row=E('section');row.className='se7-negotiation-row';
  const p=students.find(s=>s.id===(f.studentId||f.alunoId))||{};
  const status=String(f.status||'').toUpperCase();
  const refused=/RECUS|REPROV|NEGAD/.test(status),accepted=/ACEITO|EFETIVADO/.test(status),processing=/PROCESSAMENTO/.test(status);
  const label=refused?'Negada':accepted?'Aceita':processing?'Efetivação em andamento':f.atualizadoEm?'Editada — aguardando aceite':'Aguardando escolha e aceite do aluno';
  row.append(E('h3',p.fullname||p.name||f.nomeAluno||'Aluno'),E('p','Situação: '+label));
  const descriptions=[['avista','À vista'],['parcelado','Boleto parcelado'],['cartao','Cartão de crédito']];
  const offered=descriptions.filter(([k])=>f.opcoesSalvas?.[k]).map(([k,n])=>n+': '+SE7Finance.amountBR(f.opcoesSalvas[k].valorFinal));
  if(offered.length)row.append(E('p','Condições oferecidas: '+offered.join(' • ')));
  if(f.modalidadeAceita){const selected=descriptions.find(([k])=>k===f.modalidadeAceita);row.append(E('p','Modalidade escolhida: '+(selected?.[1]||f.modalidadeAceita)));}
  if(!refused&&!accepted&&!processing){
   row.append(button('Editar',()=>{selecionarAlunoNegociacao(f.studentId||f.alunoId,true);abrirModalEditarProposta(f.id);}),
    button('Aprovar — escolher modalidade',()=>{selecionarAlunoNegociacao(f.studentId||f.alunoId,true);abrirModalFecharAcordoParaProposta(f.id);}),
    button('Negar proposta',async()=>{if(!confirm('Confirmar que o aluno recusou esta proposta?'))return;await db.collection('financeLogs').doc(f.id).update({status:'PROPOSTA RECUSADA',negadaEm:new Date().toISOString()});f.status='PROPOSTA RECUSADA';refresh();}));
  }else if(processing&&f.renegotiationId){row.append(button('Retomar efetivação',()=>SE7Renegotiation.resume(f.renegotiationId,f.studentId||f.alunoId)));}
  host.append(row);
 }
 const active=logs.filter(f=>(f.renegotiationId&&f.id===f.renegotiationId)||(!f.renegotiationId&&proposalState(f)==='approved'));
 host.append(E('h3','Acompanhamento das negociações'));
 const pending=proposals.filter(f=>!/RECUS|REPROV|NEGAD|ACEITO|EFETIVADO|PROCESSAMENTO/.test(String(f.status||'').toUpperCase()));
 if(!active.length&&!pending.length)host.append(E('p','Nenhuma negociação registrada.'));
 for(const f of pending){const row=E('section');row.className='se7-negotiation-row';const s=students.find(s=>s.id===(f.studentId||f.alunoId))||{};row.append(E('h3',s.fullname||s.name||f.nomeAluno||'Aluno'),E('p','Proposta aguardando resposta — disponível acima para editar, aprovar ou negar.'));host.append(row);}
 for(const f of active){const s=students.find(s=>s.id===(f.studentId||f.alunoId))||{},row=E('section');row.className='se7-negotiation-row';const n=names(s),parts=logs.filter(p=>p.renegotiationId===f.id&&p.id!==f.id&&!/CANCELADO/.test(p.status||'')),paid=parts.filter(p=>/PAGO|QUITAD/.test(p.status||'')),paidAmount=paid.reduce((v,p)=>v+(Number.isSafeInteger(p.asaasPaidValueCents)?p.asaasPaidValueCents:Math.round(Number(p.amount||0)*100))-Number(p.cardInstallmentFeeCents||0),0);row.append(E('h3',s.fullname||s.name||'Aluno'),E('p',n.course+' • '+n.group),E('p',(f.agreementSource==='aluno'?'Pelo aplicativo do aluno':'Pelo financeiro')+' • '+(f.agreementState==='done'?'Registrada':f.renegotiationId?'Em processamento':f.status)),E('p','Total: '+SE7Finance.amountBR(f.amount)+' • '+paid.length+' de '+(f.agreementCount||parts.length)+' pagamento(s) confirmado(s) • Pago: '+SE7Finance.money(paidAmount)));if(f.renegotiationId)row.append(button('Ver negociação',()=>SE7Renegotiation.resume(f.renegotiationId,f.studentId||f.alunoId)));else row.append(E('p','Registro de acordo anterior preservado.'));host.append(row);}
 const overdue=E('details'),summary=E('summary','Alunos em atraso ('+rows.length+') — clique para expandir');summary.style.cursor='pointer';summary.style.fontWeight='700';summary.style.padding='12px 0';overdue.append(summary);
 if(!rows.length)overdue.append(E('p','Nenhum aluno em atraso.'));
 for(const r of rows){const s=r.student,n=names(s),row=E('section');row.className='se7-negotiation-row';row.append(E('h3',s.fullname||s.name||'Aluno'),E('p',n.course+' • '+n.group),E('p',r.rows.length+' mensalidade(s) em atraso'));if(r.rows.length>=6){row.append(button('Ver / negociar',()=>{selecionarAlunoNegociacao(s.id,true);abrirModalRealizarAcordo();}),button('Gerar proposta de acordo',()=>{selecionarAlunoNegociacao(s.id,true);abrirModalRealizarAcordo();}));}else row.append(E('p','Acordo manual disponível a partir de seis mensalidades vencidas.'));overdue.append(row);}
 host.append(overdue);
 const badge=document.getElementById('se7-overdue-nav-badge');if(badge){badge.hidden=rows.length===0;badge.setAttribute('aria-label',rows.length+' aluno(s) em atraso');}
}
window.SE7Agreements={refresh,isOverdue,state:proposalState,hasOverdue:id=>debtors().some(r=>r.student.id===id),isProposalOpen:()=>false,openOverdue:refresh,openProposal:()=>refresh()};refresh();let day=today();setInterval(()=>{if(day!==today()){day=today();refresh();}},60000);
