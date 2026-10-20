/* Reúne frequência e notas sem duplicar formulários ou alterar gravações. */
(()=>{
 let active=null,lock=null;
 const d=document.createElement('dialog');d.id='se7-academic-entry';d.className='se7-student-sheet';d.setAttribute('aria-labelledby','se7-academic-title');
 const head=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button'),body=document.createElement('section');title.id='se7-academic-title';close.type='button';close.textContent='Fechar';close.onclick=()=>d.close();head.append(title,close);d.append(head,body);
 d.addEventListener('close',()=>{if(active){active.parent.insertBefore(active.panel,active.next?.parentNode===active.parent?active.next:null);active=null;}if(lock){document.documentElement.style.overflow=lock.html;document.body.style.overflow=lock.body;lock=null;}});
 d.addEventListener('wheel',e=>{const max=body.scrollHeight-body.clientHeight;if(!body.contains(e.target)||max<=0||(e.deltaY<0&&body.scrollTop<=0)||(e.deltaY>0&&body.scrollTop>=max-1))e.preventDefault();},{passive:false});
 function open(kind){if(!['master','secretaria'].includes(JSON.parse(sessionStorage.getItem('usuario_logado')||'{}').perfil))return;if(!['attendance','grades'].includes(kind)||d.open)return;const parent=document.getElementById(kind==='attendance'?'se7-attendance-source':'tab-grades'),panel=parent?.firstElementChild;if(!panel)return;active={panel,parent,next:panel.nextSibling};title.textContent=kind==='attendance'?'Lançamento de frequência':'Lançamento de notas';body.replaceChildren(panel);body.scrollTop=0;lock={html:document.documentElement.style.overflow,body:document.body.style.overflow};document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';d.showModal();}
 document.addEventListener('DOMContentLoaded',()=>document.body.append(d));window.SE7AcademicEntry={open};
})();

/* Catálogo complementar: prévias não assinadas, sem emitir registros oficiais.
   O serviço de emissão atual autoriza apenas declaração, histórico, contrato e transferência.
   Os outros tipos só poderão receber botão de emissão após autorização no servidor. */
(()=>{
 'use strict';
 const docs={
  'Declarações':[
   ['situacao','Declaração de situação acadêmica','Situação cadastral da matrícula'],
   ['escolaridade','Declaração de escolaridade','Vínculo e curso do aluno'],
   ['frequencia','Declaração de frequência escolar','Consulta à situação de frequência']
  ],
  'Históricos e Notas':[
   ['boletim','Boletim de notas e frequência','Resumo acadêmico disponível'],
   ['historico-completo','Histórico escolar completo','Prévia para conferência curricular']
  ],
  'Estágios':[
   ['declaracao-estagio','Declaração de estágio','Informações cadastradas sobre o estágio'],
   ['horas-estagio','Comprovante de horas de estágio','Conferência da carga horária registrada']
  ],
  'Financeiro':[
   ['quitacao','Declaração de quitação financeira','Dependente de conferência financeira']
  ],
  'Transferências':[
   ['vinculo-encerrado','Declaração de vínculo encerrado','Dependente da situação da matrícula']
  ]
 };
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const x=s=>escape(s||'Não informado');
 const modal=document.createElement('dialog');modal.id='se7-preview-additional-doc';modal.style.cssText='width:min(950px,96vw);max-width:96vw;max-height:94vh;border:1px solid #cbd5e1;border-radius:14px;padding:0;background:#f1f5f9;color:#1e293b';
 const bar=document.createElement('header');bar.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 18px;background:#102e55;color:#fff';const heading=document.createElement('strong'),close=document.createElement('button');close.type='button';close.textContent='Fechar';close.style.cssText='padding:9px 16px;border:0;border-radius:8px;cursor:pointer';close.onclick=()=>modal.close();bar.append(heading,close);
 const notice=document.createElement('p');notice.textContent='PRÉVIA PARA CONFERÊNCIA — sem validade de emissão. A liberação oficial exige integração e autorização do serviço acadêmico.';notice.style.cssText='margin:12px 18px;padding:10px;border:1px solid #f59e0b;background:#fffbeb;color:#78350f;border-radius:8px;font-size:13px';
 const frame=document.createElement('iframe');frame.title='Prévia acadêmica sem validade';frame.setAttribute('sandbox','allow-same-origin');frame.style.cssText='width:100%;height:min(70vh,950px);border:0;background:#fff';modal.append(bar,notice,frame);
 const extras=document.createElement('section');extras.dataset.se7AdditionalDocs='true';extras.style.cssText='padding:14px 20px;border-top:1px solid #cbd5e1';
 const label=document.createElement('h3');label.textContent='Outros documentos — prévias em preparação';label.style.cssText='font-size:15px;margin:0 0 10px';extras.append(label);
 function selected(){const id=document.getElementById('report-student-select')?.value;const c=document.getElementById('report-course-select')?.value;const p=document.getElementById('report-polo-select')?.value;const g=document.getElementById('report-class-select')?.value;if(!id||!c||!p||!g)return null;const student=(typeof students!=='undefined'?students:[]).find(s=>s.id===id&&s.courseId===c&&s.poloId===p&&s.classId===g);if(!student)return null;return {student,course:(typeof courses!=='undefined'?courses:[]).find(v=>v.id===c),group:(typeof classes!=='undefined'?classes:[]).find(v=>v.id===g)};}
 function render(type,name){const current=selected();if(!current)return;const {student:s,course:c,group:g}=current;const header=window.SE7AcademicDocuments?.header?.(window.globalInstitutionData||{})||'';const info=window.SE7AcademicDocuments?.studentInfo?.(s,c||{},g||{})||'';let details='';
  if(type==='boletim'||type==='historico-completo')details='<p>A emissão definitiva deverá consultar notas, frequências, situação por disciplina e matriz curricular atualizadas. Esta prévia não certifica aprovação nem carga horária concluída.</p>';
  else if(type==='frequencia')details='<p>Para a versão oficial, os registros de presença e ausência deverão ser apurados pela regra acadêmica vigente. Nenhum percentual é presumido nesta prévia.</p>';
  else if(type==='declaracao-estagio'||type==='horas-estagio')details='<p>A carga horária, o campo de estágio, o supervisor e o período deverão ser confirmados nos registros de estágio antes da emissão.</p>';
  else if(type==='quitacao')details='<p>Este documento somente poderá ser emitido depois da conferência de débitos e pagamentos no sistema financeiro. Esta prévia não atesta quitação.</p>';
  else if(type==='vinculo-encerrado')details='<p>O encerramento do vínculo deverá ser validado no cadastro e no histórico acadêmico antes da emissão.</p>';
  else details='<p>Conforme os dados atualmente cadastrados, a situação informada é: <strong>'+x(s.status)+'</strong>. Os dados deverão ser conferidos na emissão.</p>';
  const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>@page{size:A4;margin:14mm}body{margin:15mm;font:12px/1.7 Arial,sans-serif;color:#172b4d}h1{text-align:center;font-size:19px;color:#173d70;margin:28px 0}.se7-preview-warning{border:2px solid #dc2626;padding:10px;text-align:center;font-weight:bold;color:#991b1b}.academic-student{padding:12px;border:1px solid #cbd5e1}.detail{margin-top:20px}footer{margin-top:50px;text-align:center;color:#64748b}</style></head><body><div class="se7-preview-warning">PRÉVIA SEM VALIDADE — NÃO É DOCUMENTO EMITIDO</div>'+header+'<h1>'+escape(name.toUpperCase())+'</h1>'+info+'<div class="detail"><p>Aluno(a): <strong>'+x(s.fullname)+'</strong> • Matrícula: '+x(s.code)+'</p><p>Curso: '+x(c?.name)+' • Turma: '+x(g?.name)+'</p>'+details+'</div><footer>Modelo em preparação — Secretaria Acadêmica SE7</footer></body></html>';
  heading.textContent=name;frame.srcdoc=window.SE7Safe?.document?.(html)||html;modal.showModal();
 }
 function inject(){const source=document.getElementById('se7-document-category-dialog');if(!source?.open)return;const title=source.querySelector('#se7-category-title')?.textContent;const options=docs[title];if(!options){extras.remove();return;}const current=selected();if(!current){extras.remove();return;}extras.replaceChildren(label);for(const [type,name,description] of options){const row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:12px 0;border-bottom:1px solid #e2e8f0';const text=document.createElement('div');const strong=document.createElement('strong');strong.textContent=name;const small=document.createElement('small');small.textContent=description;small.style.cssText='display:block;opacity:.75;margin-top:3px';text.append(strong,small);const actions=document.createElement('div'),see=document.createElement('button'),issue=document.createElement('button');see.type='button';see.textContent='Ver documento';see.onclick=()=>render(type,name);issue.type='button';issue.textContent='Emitir documento';issue.disabled=true;issue.title='Aguardando implementação e autorização no servidor';for(const b of [see,issue])b.style.cssText='padding:8px 10px;margin-left:6px;border-radius:7px;border:1px solid #b8c5d6;background:#fff;color:#173d70';issue.style.opacity='.45';actions.append(see,issue);row.append(text,actions);extras.append(row);}source.append(extras);}
 document.addEventListener('DOMContentLoaded',()=>{document.body.append(modal);const source=document.getElementById('se7-document-category-dialog');if(!source)return;source.addEventListener('click',()=>queueMicrotask(inject));source.addEventListener('close',()=>extras.remove());const catalog=document.querySelector('#se7-document-emission .se7-doc-catalog');catalog?.addEventListener('click',()=>queueMicrotask(inject));});
})();
