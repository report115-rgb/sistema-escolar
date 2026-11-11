(function(){
const modularCourses=()=>typeof courses==='undefined'?[]:courses.filter(c=>c.nivel==='Supletivo'&&c.ejaMode==='modular');
window.se7GestaoModularAtualizar=function(){const select=document.getElementById('se7-gestao-modular-curso');if(!select)return;const previous=select.value;select.replaceChildren(new Option('Selecione o curso',''));modularCourses().forEach(c=>select.add(new Option(c.name||'EJA Modular',c.id)));if(modularCourses().some(c=>c.id===previous))select.value=previous;const note=document.getElementById('se7-gestao-modular-aviso');if(note)note.textContent=select.value?'Escolha a operação acima.':'Selecione um curso EJA Modular cadastrado em Cursos.';};
window.se7GestaoModularDiagnostico=async function(courseId){
 const area=document.getElementById('se7-gestao-modular-aviso');if(!area)return;area.replaceChildren();
 const loading=document.createElement('p');loading.textContent='Verificando materiais, links, questões e publicação...';area.append(loading);
 try{const data=await SE7.api('eja-modular-readiness',{courseId});if(document.getElementById('se7-gestao-modular-curso')?.value!==courseId)return;area.replaceChildren();
 const title=document.createElement('strong');title.textContent='Preparação: '+data.readyCount+'/'+data.total+' disciplinas • '+data.issueCount+' pendências';area.append(title);
 const audit=document.createElement('p');audit.className='text-sm font-semibold my-2';audit.textContent='Checklist pedagógico: '+data.auditPassed+' de '+data.auditTotal+' verificações atendidas';area.append(audit);
 const note=document.createElement('p');note.textContent=(data.enrollmentEnabled?'Pré-requisito de matrícula LIBERADO. ':'Pré-requisito de matrícula BLOQUEADO. ')+data.note;note.className='my-2 font-semibold';area.append(note);
 const toolbar=document.createElement('div');toolbar.className='flex flex-wrap gap-2 my-3';
 const filter=document.createElement('select');filter.className='p-2 rounded border dark:bg-slate-800';[['all','Todas'],['pending','Com pendências'],['ready','Completas']].forEach(([value,label])=>filter.add(new Option(label,value)));toolbar.append(filter);
 const copy=document.createElement('button');copy.type='button';copy.textContent='Copiar relatório';copy.className='px-3 py-2 rounded bg-slate-700 text-white';toolbar.append(copy);
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Atualizar';refresh.className='px-3 py-2 rounded bg-blue-700 text-white';refresh.onclick=()=>window.se7GestaoModularDiagnostico(courseId);toolbar.append(refresh);area.append(toolbar);
 const list=document.createElement('div');area.append(list);
 const renderRows=()=>{list.replaceChildren();const visible=data.subjects.filter(s=>filter.value==='all'||(filter.value==='ready'?s.ready:!s.ready));
 if(!visible.length){const p=document.createElement('p');p.textContent='Nenhuma disciplina neste filtro.';list.append(p);}
 visible.forEach(s=>{const card=document.createElement('details');card.className='border border-slate-600 rounded-lg p-3 my-2';const head=document.createElement('summary');head.className='cursor-pointer font-semibold';head.textContent=s.subjectName+' — '+(s.ready?'Pronta':'Pendente ('+s.issues.length+')');card.append(head);
 const state=document.createElement('p');state.className='text-xs my-2';state.textContent='Materiais: '+(s.materialsReady?'OK':'Pendentes')+' | Avaliação: '+(s.examReady?'Publicada e válida':'Pendente');card.append(state);
 const checklist=document.createElement('details');checklist.className='my-2 border-t border-slate-700 pt-2';const checklistHead=document.createElement('summary');checklistHead.textContent='Ver 20 verificações ('+s.audit.filter(x=>x.ok).length+'/20)';checklistHead.className='cursor-pointer text-xs font-semibold';checklist.append(checklistHead);s.audit.forEach(item=>{const row=document.createElement('p');row.className='text-xs my-1';row.textContent=(item.ok?'✓ ':'○ ')+item.label;checklist.append(row);});card.append(checklist);
 s.issues.forEach(issue=>{const p=document.createElement('p');p.className='text-xs my-1';p.textContent='• '+issue;card.append(p);});
 const dates=document.createElement('p');dates.className='text-xs text-slate-400 my-2';dates.textContent='Materiais atualizados: '+(s.materialsUpdatedAt||'—')+' | Prova publicada: '+(s.examPublishedAt||'—');card.append(dates);
 const actions=document.createElement('div');actions.className='flex flex-wrap gap-2';
 [['Abrir materiais','materiais'],['Abrir avaliação','avaliacoes']].forEach(([label,type])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className='px-3 py-2 rounded bg-indigo-700 text-white text-xs';b.onclick=()=>window.se7GestaoModularAbrir(type);actions.append(b);});card.append(actions);list.append(card);});
 };filter.onchange=renderRows;renderRows();
 copy.onclick=async()=>{const report=['EJA Modular — diagnóstico',title.textContent,data.note,...data.subjects.map(s=>s.subjectName+' | '+s.audit.filter(x=>x.ok).length+'/20 verificações | '+(s.ready?'Pronta':s.issues.join('; ')))].join('\n');try{await navigator.clipboard.writeText(report);copy.textContent='Relatório copiado';}catch{copy.textContent='Não foi possível copiar';}};
 }catch(error){area.replaceChildren();const p=document.createElement('p');p.textContent='Não foi possível verificar: '+error.message;area.append(p);}
};
window.se7GestaoModularFinanceiro=async function(courseId){
 const money=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const formatDate=s=>s?s.split('-').reverse().join('/'):'Prazo indeterminado';
 const modal=document.createElement('dialog');modal.className='eja-modal-prova';modal.style.cssText='padding:26px;max-height:90dvh;overflow:auto;width:min(95vw,760px);border-radius:18px';
 const title=document.createElement('h3');title.className='font-bold text-lg mb-2';title.textContent='Valores configurados — EJA Modular';modal.append(title);
 const description=document.createElement('p');description.className='text-sm mb-4';description.textContent='Planos de preço por período. Os valores contratados anteriormente não são alterados.';modal.append(description);
 const status=document.createElement('p');status.className='text-sm my-3';status.setAttribute('role','status');status.setAttribute('aria-live','polite');modal.append(status);
 const list=document.createElement('div');list.className='space-y-3 mb-2';modal.append(list);
 const editor=document.createElement('form');editor.className='space-y-3 border-t border-slate-600 pt-4';editor.hidden=true;
 const heading=document.createElement('h4');heading.className='font-bold';editor.append(heading);
 const field=(label,type)=>{const wrap=document.createElement('label');wrap.className='block text-sm font-semibold';wrap.textContent=label;const input=document.createElement('input');input.type=type;input.required=true;input.className='block w-full p-3 mt-2 rounded-lg border dark:bg-slate-800';wrap.append(input);editor.append(wrap);return input;};
 const amount=field('Valor total do curso (R$)','text');amount.inputMode='decimal';amount.placeholder='Ex.: 1800,00';
 const start=field('Data de início','date');
 const end=field('Data de fim','date');
 const unlimited=document.createElement('label');unlimited.className='flex items-center gap-2 text-sm';const check=document.createElement('input');check.type='checkbox';unlimited.append(check,document.createTextNode('Prazo indeterminado (sem data de fim)'));editor.append(unlimited);
 check.onchange=()=>{end.disabled=check.checked;end.required=!check.checked;if(check.checked)end.value='';};
 const preview=document.createElement('div');preview.className='space-y-2';editor.append(preview);
 const feedback=document.createElement('p');feedback.className='text-sm';feedback.setAttribute('role','status');editor.append(feedback);
 const buttons=document.createElement('div');buttons.className='flex justify-end gap-3';
 const save=document.createElement('button');save.type='submit';save.className='px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold';save.textContent='Salvar plano';buttons.append(save);
 const cancel=document.createElement('button');cancel.type='button';cancel.className='px-5 py-2.5 rounded-xl border border-slate-500';cancel.textContent='Cancelar';cancel.onclick=()=>{editor.hidden=true;feedback.textContent='';};buttons.append(cancel);editor.append(buttons);modal.append(editor);
 const footer=document.createElement('div');footer.className='flex flex-wrap justify-end items-center gap-3 mt-5 pt-1';
 const add=document.createElement('button');add.type='button';add.className='px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold';add.textContent='Configurar novo valor';footer.append(add);
 const close=document.createElement('button');close.type='button';close.className='px-5 py-2.5 rounded-xl border border-slate-500';close.textContent='Fechar';close.onclick=()=>modal.close();footer.append(close);modal.append(footer);
 let plans=[],editing=null,legacy=null,busy=false;
 const parse=()=>{const raw=amount.value.trim().replace(/^R\$\s*/,'').replace(/\./g,'').replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null;const n=Math.round(Number(raw)*100);return Number.isSafeInteger(n)&&n>0&&n<=100000000?n:null;};
 const recalc=()=>{preview.replaceChildren();const cents=parse();if(!cents)return;for(const months of [3,6,9]){const p=document.createElement('p');p.className='rounded-lg border border-slate-600 p-3 text-sm';const base=Math.floor(cents/months),extra=cents%months;p.textContent=months+' meses: '+(extra?extra+' parcela(s) de '+money(base+1)+' e '+(months-extra)+' de '+money(base):months+' parcelas de '+money(base));preview.append(p);}};
 amount.oninput=recalc;
 const edit=p=>{editing=p?.id||null;heading.textContent=editing?'Editar plano financeiro':'Configurar novo valor';amount.value=p?(p.totalCents/100).toFixed(2).replace('.',','):'';start.value=p?.startDate||new Date().toISOString().slice(0,10);end.value=p?.endDate||'';check.checked=p?!p.endDate:false;check.onchange();editor.hidden=false;feedback.textContent='';recalc();editor.scrollIntoView({block:'nearest',behavior:'smooth'});};
 const render=()=>{
  list.replaceChildren();
  if(legacy!=null&&!plans.length){
   const card=document.createElement('div');card.className='rounded-xl border border-slate-600 p-4 flex flex-wrap items-center justify-between gap-3';
   const info=document.createElement('div');info.className='space-y-1';
   const value=document.createElement('strong');value.textContent=money(legacy);info.append(value);
   const note=document.createElement('p');note.className='text-xs';note.textContent='Valor configurado anteriormente • Defina o período de vigência';info.append(note);card.append(info);
   const button=document.createElement('button');button.type='button';button.className='px-4 py-2 rounded-lg border border-slate-500';button.textContent='Editar';
   button.onclick=()=>edit({totalCents:legacy,startDate:new Date().toISOString().slice(0,10),endDate:null});
   card.append(button);list.append(card);
  }
  if(!plans.length){const p=document.createElement('p');p.textContent='Nenhum plano com período cadastrado.';list.append(p);}
  for(const p of plans){
   const card=document.createElement('div');card.className='rounded-xl border border-slate-600 p-4 flex flex-wrap items-center justify-between gap-3';
   const info=document.createElement('div');info.className='space-y-1';const name=document.createElement('strong');name.textContent=money(p.totalCents);info.append(name);
   const period=document.createElement('p');period.className='text-xs';period.textContent=formatDate(p.startDate)+' até '+formatDate(p.endDate);info.append(period);
   const date=new Date().toISOString().slice(0,10),tag=document.createElement('small');tag.textContent=date<p.startDate?'Programado':p.endDate&&date>p.endDate?'Encerrado':'Vigente';info.append(tag);card.append(info);
   const button=document.createElement('button');button.type='button';button.className='px-4 py-2 rounded-lg border border-slate-500';button.textContent='Editar';button.onclick=()=>edit(p);card.append(button);list.append(card);
  }
 };
 add.onclick=()=>edit(null);
 editor.onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const cents=parse(),startDate=start.value,endDate=check.checked?null:end.value;
  if(!cents||!startDate||(!check.checked&&!endDate)||endDate&&endDate<startDate){feedback.textContent='Informe valor e datas válidos.';return;}
  const conflict=plans.find(p=>p.id!==editing&&startDate<=(p.endDate||'9999-12-31')&&p.startDate<=(endDate||'9999-12-31'));
  if(conflict){feedback.textContent='Essa data já pertence a outro plano. Deseja editar o plano existente?';if(confirm('Essa data já pertence ao plano '+money(conflict.totalCents)+' ('+formatDate(conflict.startDate)+' até '+formatDate(conflict.endDate)+'). Deseja editar?'))edit(conflict);return;}
  busy=true;save.disabled=true;save.textContent='Salvando...';feedback.textContent='Aguarde, salvando plano...';
  try{
   const result=await SE7.api('eja-modular-tuition',{operation:'save-plan',courseId,planId:editing,totalCents:cents,startDate,endDate});
   if(!result?.saved)throw Error('O servidor não confirmou o salvamento.');
   const refreshed=await SE7.api('eja-modular-tuition',{operation:'read',courseId});
   plans=refreshed.pricePlans||[];legacy=refreshed.totalCents;render();editor.hidden=true;status.textContent='Valores salvos com sucesso!';
  }catch(err){feedback.textContent='Não foi possível salvar: '+(err.message||'Erro desconhecido');}
  finally{busy=false;save.disabled=false;save.textContent='Salvar plano';}
 };
 modal.onclose=()=>modal.remove();document.body.append(modal);modal.showModal();
 status.textContent='Carregando valores...';
 try{const data=await SE7.api('eja-modular-tuition',{operation:'read',courseId});plans=data.pricePlans||[];legacy=data.totalCents;render();status.textContent='';}
 catch(err){status.textContent='Não foi possível carregar os valores: '+err.message;add.disabled=true;}
};
window.se7GestaoModularPlanoFinanceiro=function(courseId){
 const dlg=document.createElement('dialog');dlg.className='eja-modal-prova';dlg.style.cssText='padding:22px;max-height:90dvh;overflow:auto;width:min(95vw,720px)';
 const heading=document.createElement('h3');heading.textContent='Plano financeiro do aluno — EJA Modular';heading.className='font-bold text-lg mb-2';dlg.append(heading);
 const notice=document.createElement('p');notice.className='text-xs mb-4';notice.textContent='Planejamento individual. Não emite boletos, não cobra o aluno e não libera o AVA. O valor total é definido em Valores e mensalidades.';dlg.append(notice);
 const field=(title,element)=>{const l=document.createElement('label');l.className='block text-sm font-semibold mb-3';l.textContent=title;element.className='block w-full mt-2 p-3 rounded border dark:bg-slate-800';l.append(element);dlg.append(l);return element;};
 const student=field('Identificador da matrícula do aluno',document.createElement('input'));student.placeholder='ID da matrícula';student.maxLength=128;
 const months=field('Duração contratada',document.createElement('select'));[3,6,9].forEach(n=>months.add(new Option(n+' meses',n)));
 const due=field('Vencimento da primeira mensalidade',document.createElement('input'));due.type='date';
 const msg=document.createElement('p');msg.className='text-sm my-3';dlg.append(msg);
 const summary=document.createElement('div');summary.className='space-y-2 my-3';dlg.append(summary);
 const toolbar=document.createElement('div');toolbar.className='flex flex-wrap gap-2';
 const btn=(name,color,fn)=>{const b=document.createElement('button');b.type='button';b.className='px-4 py-2 rounded text-white '+color;b.textContent=name;b.onclick=fn;toolbar.append(b);return b;};
 let version=0,loadedStudent='',loadedPlan=null;
 const money=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const render=plan=>{summary.replaceChildren();if(!plan)return;const title=document.createElement('p');title.className='font-semibold';title.textContent=plan.months+' parcelas • Total '+money(plan.totalCents)+' • Primeiro vencimento '+plan.firstDueDate;summary.append(title);plan.installments.forEach(p=>{const line=document.createElement('p');line.className='text-sm border-b dark:border-slate-600 py-2';line.textContent='Parcela '+p.number+'/'+plan.months+' — '+money(p.amountCents)+' — '+p.dueDate;summary.append(line);});};
 const consult=btn('Consultar matrícula','bg-slate-700',async()=>{const id=student.value.trim();if(!id){msg.textContent='Informe o ID da matrícula.';return;}try{const data=await SE7.api('eja-modular-finance-plan',{operation:'read',studentId:id,courseId});loadedStudent=id;loadedPlan=data.plan;version=data.plan?.version||0;if(data.plan){months.value=String(data.plan.months);due.value=data.plan.firstDueDate;render(data.plan);}else summary.replaceChildren();msg.textContent=data.activated?'Curso ativado — plano somente consulta.':data.plan?.firstPaymentLinked?'Primeira cobrança vinculada — plano bloqueado.':'Matrícula conferida. Valor total: '+(data.configuredTotalCents?money(data.configuredTotalCents):'não configurado');}catch(e){loadedStudent='';msg.textContent='Consulta não concluída: '+e.message;}});
 const preview=btn('Calcular parcelas','bg-blue-700',async()=>{if(student.value.trim()!==loadedStudent){msg.textContent='Consulte esta matrícula antes de calcular.';return;}try{const r=await SE7.api('eja-modular-finance-plan',{operation:'preview',studentId:loadedStudent,courseId,months:Number(months.value),firstDueDate:due.value});render(r.plan);msg.textContent='Prévia calculada. Nenhuma cobrança foi criada.';}catch(e){msg.textContent='Prévia não concluída: '+e.message;}});
 const save=btn('Salvar plano','bg-emerald-700',async()=>{if(student.value.trim()!==loadedStudent){msg.textContent='Consulte a matrícula antes de salvar.';return;}save.disabled=true;try{const r=await SE7.api('eja-modular-finance-plan',{operation:'save',studentId:loadedStudent,courseId,months:Number(months.value),firstDueDate:due.value,expectedVersion:version});version=r.plan.version;loadedPlan=r.plan;render(r.plan);msg.textContent='Plano salvo. Nenhuma cobrança emitida. Versão '+version+'.';}catch(e){msg.textContent='Não foi possível salvar: '+e.message;}finally{save.disabled=false;}});
 btn('Fechar','bg-slate-600',()=>dlg.close());dlg.append(toolbar);dlg.onclose=()=>dlg.remove();document.body.append(dlg);dlg.showModal();
};
window.se7GestaoModularAbrir=function(type){const id=document.getElementById('se7-gestao-modular-curso')?.value;const course=modularCourses().find(c=>c.id===id);if(!course){alert('Selecione um curso EJA Modular.');return;}if(type==='materiais')return window.se7AbrirMateriaisModulares(id);if(type==='avaliacoes')return window.se7AbrirAvaliacaoModular(id);if(type==='diagnostico')return window.se7GestaoModularDiagnostico(id);if(type==='financeiro')return window.se7GestaoModularFinanceiro(id);if(type==='plano-financeiro')return window.se7GestaoModularPlanoFinanceiro(id);if(type!=='simulador')return;
const dialog=document.createElement('dialog');dialog.className='eja-modal-prova';dialog.style.cssText='padding:20px;overflow:auto;max-height:90dvh;width:min(95vw,950px)';
const title=document.createElement('h3');title.textContent='Simulador do AVA — '+course.name;title.className='font-bold text-lg mb-2';dialog.append(title);
const notice=document.createElement('p');notice.textContent='Ambiente exclusivamente ilustrativo. Nenhuma ação altera notas, pagamentos, matrículas ou documentos de alunos.';notice.className='text-xs text-slate-300 mb-4';dialog.append(notice);
const controls=document.createElement('div');controls.className='flex flex-wrap gap-3 mb-4 items-center';
const duration=document.createElement('select');duration.className='p-2 rounded bg-slate-800 border border-slate-600';[3,6,9].forEach(n=>duration.add(new Option(n+' meses',n)));controls.append(duration);
const day=document.createElement('select');day.className='p-2 rounded bg-slate-800 border border-slate-600';[0,7,14,27,30,60,90,180,270].forEach(n=>day.add(new Option('Dia '+n,n)));controls.append(day);
const reset=document.createElement('button');reset.type='button';reset.textContent='Reiniciar simulação';reset.className='px-3 py-2 rounded bg-slate-600 text-white';controls.append(reset);dialog.append(controls);
const content=document.createElement('div');dialog.append(content);
const state=new Map();const subjectKey=s=>String(s.id||s.name||s.nome||'');
const subjects=Array.isArray(course.subjects)?course.subjects:[];
const btn=(label,action,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.className='px-3 py-2 rounded-lg bg-blue-700 text-white text-xs font-semibold disabled:opacity-40';b.onclick=action;return b;};
const line=(label,status)=>{const row=document.createElement('div');row.className='flex justify-between gap-2 text-sm py-2 border-b border-slate-700';const name=document.createElement('span');name.textContent=label;const value=document.createElement('span');value.textContent=status;value.className='text-xs text-blue-300';row.append(name,value);return row;};
const render=()=>{
 content.replaceChildren();
 const elapsed=Number(day.value),months=Number(duration.value),total=subjects.length;
 const completed=subjects.filter(s=>state.get(subjectKey(s))?.concluded).length;
 const summary=document.createElement('p');summary.className='text-sm font-semibold mb-3';summary.textContent='Progresso geral simulado: '+(total?Math.round(completed/total*100):0)+'% • '+completed+' de '+total+' disciplinas concluídas';content.append(summary);
 if(!total){content.append(line('Disciplinas','Cadastre disciplinas em Cursos'));return;}
 subjects.forEach((sub,i)=>{
  const key=subjectKey(sub),st=state.get(key)||{pdf:false,lessons:[false,false,false],approved:false,concluded:false};
  const cycle=Math.floor(i*months/total),start=cycle*30,days=elapsed-start,available=days>=0;
  const progress=st.concluded?100:Math.round((Number(st.pdf)+st.lessons.filter(Boolean).length+Number(st.approved))/6*90);
  const card=document.createElement('details');card.className='rounded-xl border border-slate-600 p-3 my-2';
  const heading=document.createElement('summary');heading.className='font-semibold cursor-pointer';heading.textContent=(sub.name||sub.nome||'Disciplina '+(i+1))+' — '+progress+'% • '+(st.concluded?'Concluída':available?'Em andamento':'Aguardando liberação');card.append(heading);
  const bar=document.createElement('div');bar.className='h-2 rounded-full bg-slate-700 my-3';const fill=document.createElement('div');fill.className='h-full rounded-full bg-blue-500';fill.style.width=progress+'%';bar.append(fill);card.append(bar);
  card.append(line('Liberação da disciplina','Dia '+start));
  if(st.concluded){card.append(line('Situação','Concluída — somente consulta'));content.append(card);return;}
  const pdf=document.createElement('div');pdf.className='flex flex-wrap items-center justify-between gap-2 my-2';pdf.append(line('Apostila PDF',st.pdf?'Acessada':available?'Disponível':'Bloqueada'));pdf.append(btn('Simular acesso',()=>{st.pdf=true;state.set(key,st);render();},!available||st.pdf));card.append(pdf);
  st.lessons.forEach((done,j)=>{const ready=available&&days>=j*7;const row=document.createElement('div');row.className='flex flex-wrap justify-between items-center gap-2 my-2';row.append(line('Videoaula '+(j+1),done?'Concluída':ready?'Disponível':'Bloqueada'));row.append(btn('Simular conclusão',()=>{st.lessons[j]=true;state.set(key,st);render();},!ready||done));card.append(row);});
  const examReady=days>=27&&st.pdf&&st.lessons.every(Boolean);
  card.append(line('Avaliação final',st.approved?'Aprovada':examReady?'Disponível para simulação':'Bloqueada'));
  if(!st.approved)card.append(btn('Simular aprovação (nota ≥ 5,0)',()=>{st.approved=true;state.set(key,st);render();},!examReady));
  else card.append(btn('Concluir disciplina',()=>{st.concluded=true;state.set(key,st);render();}));
  content.append(card);
 });
};
duration.onchange=()=>{state.clear();render();};day.onchange=render;reset.onclick=()=>{state.clear();day.value='0';render();};render();
const close=btn('Fechar',()=>dialog.close());close.className+=' mt-3';dialog.append(close);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
};
})();


/* AVA administrativo: visualização por disciplina, sem modificar os dados dos alunos. */
(function(){
 const element=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const action=(label,fn)=>{const n=element('button',label);n.type='button';n.className='px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold';n.onclick=fn;return n;};
 const course=()=>typeof courses==='undefined'?null:courses.find(c=>c.nivel==='Supletivo'&&c.ejaMode==='modular'&&c.ejaStage==='medio')||null;
 const openEditor=(kind,subjectId)=>{
  const c=course();if(!c)return;
  if(kind==='exam')window.se7AbrirAvaliacaoModular(c.id);else window.se7AbrirMateriaisModulares(c.id);
  let attempts=0;
  const timer=setInterval(()=>{
   const dialogs=[...document.querySelectorAll('dialog[open]')];
   const dialog=dialogs.find(d=>d.textContent.includes(kind==='exam'?'Avaliações EJA Modular':'Conteúdo pedagógico'));
   const select=dialog?.querySelector('select');
   if(select&&[...select.options].some(o=>String(o.value)===String(subjectId))){
    clearInterval(timer);select.value=String(subjectId);select.dispatchEvent(new Event('change'));
   }else if(++attempts>=20)clearInterval(timer);
  },50);
 };
 window.se7ModularAvaModal=function(subjectId,kind='apostila'){
  const c=course(),s=c?.subjects?.find(x=>String(x.id)===String(subjectId));if(!s)return;
  if(!['apostila','videos','exam'].includes(kind))return;
  const dialog=element('dialog');dialog.className='eja-modal-prova';dialog.style.cssText='width:min(95vw,800px);max-height:90dvh;overflow:auto;padding:20px';
  const header=element('div');header.className='flex justify-between items-center gap-3 mb-4';
  const heading=element('h3',(s.name||s.nome||'Disciplina')+' — '+({apostila:'Apostila',videos:'3 videoaulas',exam:'Avaliação'}[kind]));heading.className='text-lg font-bold';header.append(heading,action('Fechar',()=>dialog.close()));dialog.append(header);
  const body=element('div');body.className='space-y-3';dialog.append(body);
  const status=element('p');status.className='text-xs mt-3';dialog.append(status);
  const field=(label,value,placeholder)=>{
   const wrap=element('label');wrap.className='block text-sm font-semibold';wrap.append(element('span',label));
   const input=element('input');input.type='url';input.value=value||'';input.placeholder=placeholder;input.className='w-full mt-1 p-3 rounded-lg border border-slate-600 bg-slate-900 text-white';wrap.append(input);body.append(wrap);return input;
  };
  const load=async()=>{
   body.replaceChildren();status.textContent='Carregando '+({apostila:'apostila',videos:'videoaulas',exam:'avaliação'}[kind])+'...';
   try{
    if(kind==='exam'){
     const result=await SE7.api('eja-modular-exam',{operation:'read',courseId:c.id,subjectId:s.id}),exam=result.exam||null;
     if(!dialog.open)return;
     body.append(element('p',exam?(exam.published?'Avaliação publicada — edição bloqueada.':'Avaliação em rascunho — disponível para edição.'):'Nenhuma avaliação cadastrada para esta disciplina.'));
     body.append(action(exam?'Visualizar / editar avaliação':'Cadastrar avaliação',()=>{dialog.close();openEditor('exam',s.id);}));
     if(!exam){const importButton=action('Resgatar da Prova Única',async()=>{importButton.disabled=true;status.textContent='Procurando avaliação na Prova Única...';try{await SE7.api('eja-modular-exam',{operation:'import',courseId:c.id,subjectId:s.id});await load();}catch(e){status.textContent='Não foi possível importar: '+e.message;importButton.disabled=false;}});body.append(importButton);}
    }else{
     const result=await SE7.api('eja-modular-materials',{operation:'read',courseId:c.id,subjectId:s.id}),materials=result.materials||{},lessons=materials.lessons||[];
     if(!dialog.open)return;
     const pdf=kind==='apostila'?field('Apostila PDF',materials.apostilaUrl,'https://drive.google.com/...'):null;
     const urls=kind==='videos'?[0,1,2].map(i=>field('Videoaula '+(i+1),lessons[i]?.url,'https://drive.google.com/...')):[];
     const save=action(kind==='apostila'?'Salvar apostila':'Salvar videoaulas',async()=>{
      save.disabled=true;status.textContent='Salvando...';
      try{
       // Releitura antes de salvar para preservar os campos da outra modalidade.
       const latest=(await SE7.api('eja-modular-materials',{operation:'read',courseId:c.id,subjectId:s.id})).materials||{};
       const payload={...latest};
       if(kind==='apostila')payload.apostilaUrl=pdf.value.trim();
       else payload.lessons=urls.map((url,i)=>({title:latest.lessons?.[i]?.title||lessons[i]?.title||'Videoaula '+(i+1),url:url.value.trim()}));
       await SE7.api('eja-modular-materials',{operation:'save',courseId:c.id,subjectId:s.id,materials:payload});
       status.textContent='Salvo com sucesso.';document.dispatchEvent(new Event('se7-modular-materials-saved'));
      }catch(e){status.textContent='Não foi possível salvar: '+e.message;}finally{save.disabled=false;}
     });body.append(save);
    }
    if(!status.textContent.startsWith('Salvo'))status.textContent='';
   }catch(e){status.textContent='Não foi possível carregar: '+(e.message||e);}
  };
  dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();load();
 };

 function setup(){
  const root=document.getElementById('subeja-modular'),select=document.getElementById('se7-gestao-modular-curso');
  if(!root||!select||document.getElementById('se7-modular-inner-tabs'))return;
  const section=select.closest('section')||root.querySelector('section');if(!section)return;
  const current=()=>course();
  const sync=()=>{const c=current();if(c&&String(select.value)!==String(c.id)){if(![...select.options].some(o=>String(o.value)===String(c.id)))select.add(new Option(c.name||'EJA Modular',c.id));select.value=String(c.id);}return c;};
  const originalUpdate=window.se7GestaoModularAtualizar;
  if(typeof originalUpdate==='function')window.se7GestaoModularAtualizar=function(...args){const result=originalUpdate.apply(this,args);sync();renderSubjects();renderStudents();return result;};
  const originalOpen=window.se7GestaoModularAbrir;
  if(typeof originalOpen==='function')window.se7GestaoModularAbrir=function(type){sync();return originalOpen(type);};
  const oldButtons=section.querySelector('div.flex.flex-wrap.gap-2');if(oldButtons)oldButtons.style.setProperty('display','none','important');
  select.parentElement.style.setProperty('display','none','important');
  const note=document.getElementById('se7-gestao-modular-aviso');if(note)note.style.display='none';
  const tabs=element('div');tabs.id='se7-modular-inner-tabs';tabs.className='flex flex-wrap gap-2 border-b border-slate-600 pb-3 mb-4';tabs.setAttribute('role','tablist');
  const tabDefs=[['students','Alunos Modular'],['ava','AVA'],['config','Configurações']];
  const panels={};
  const tabButtons={};
  for(const [id,label] of tabDefs){
   const button=action(label,()=>activate(id));button.setAttribute('role','tab');button.className='px-4 py-3 text-sm font-semibold rounded-t-lg';tabs.append(button);tabButtons[id]=button;
   const panel=element('div');panel.id='se7-modular-'+id;panel.className='space-y-3';panels[id]=panel;
  }
  const studentsPanel=panels.students;
  studentsPanel.append(element('h4','Alunos EJA Modular'));
  const studentWrap=element('div');studentWrap.className='overflow-x-auto rounded-xl border border-slate-600';
  const studentTable=element('table');studentTable.className='w-full text-left text-xs';
  const thead=element('thead');const headrow=element('tr');
  for(const label of ['Matrícula','Aluno','Turma','Situação','Ações']){const th=element('th',label);th.className='p-3 border-b border-slate-600';headrow.append(th);}
  thead.append(headrow);studentTable.append(thead);
  const tbody=element('tbody');tbody.id='se7-modular-students';studentTable.append(tbody);studentWrap.append(studentTable);studentsPanel.append(studentWrap);
  const ava=panels.ava;ava.append(element('p','Disciplinas do EJA Modular. Clique para configurar apostila, videoaulas e avaliação.'));
  const list=element('div');list.id='se7-modular-disciplines';list.className='grid gap-3';ava.append(list);
  const config=panels.config;
  const settingsCard=element('div');settingsCard.className='rounded-xl border border-slate-600 bg-slate-800/50 p-5 flex flex-wrap items-center justify-between gap-4';
  const info=element('div');info.append(element('h4','Valores e mensalidades'),element('p','Gerencie planos financeiros por período, promoções e mensalidades de 3, 6 e 9 meses.'));settingsCard.append(info);
  settingsCard.append(action('Valores configurados',()=>{const c=sync();if(c)window.se7GestaoModularFinanceiro(c.id);else alert('Cadastre o curso EJA Modular Ensino Médio em Cursos.');}));
  config.append(settingsCard);
  section.insertBefore(tabs,select.parentElement);
  for(const id of ['students','ava','config'])section.insertBefore(panels[id],select.parentElement);
  function activate(id){
   for(const [key,panel] of Object.entries(panels)){
    panel.hidden=key!==id;panel.style.display=key===id?'':'none';
    tabButtons[key].setAttribute('aria-selected',String(key===id));
    tabButtons[key].classList.toggle('bg-blue-700',key===id);
    tabButtons[key].classList.toggle('text-white',key===id);
   }
   sync();if(id==='students')renderStudents();if(id==='ava')renderSubjects();
  }
  const readinessCache=new Map();async function se7ReadinessCached(courseId){const item=readinessCache.get(courseId);if(item&&Date.now()-item.at<120000)return item.promise;const promise=SE7.api('eja-modular-readiness',{courseId});readinessCache.set(courseId,{at:Date.now(),promise});try{return await promise;}catch(e){readinessCache.delete(courseId);throw e;}}
  let avaLoadSequence=0;
  function renderSubjects(){
   sync();list.replaceChildren();const c=current(),sequence=++avaLoadSequence;
   if(!c){list.append(element('p','Cadastre o EJA Modular Ensino Médio em Cursos.'));return;}
   const subjects=Array.isArray(c.subjects)?c.subjects:[];
   if(!subjects.length){list.append(element('p','Nenhuma disciplina vinculada. Cadastre em Sistema > Disciplinas.'));return;}
   if(!document.getElementById('se7-modular-ava-status-style')){
    const style=document.createElement('style');style.id='se7-modular-ava-status-style';
    style.textContent='@keyframes se7ModularHourglass{0%,42%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes se7ModularPulse{0%,100%{opacity:1}50%{opacity:.48}}.se7-modular-hourglass{display:inline-block;animation:se7ModularHourglass 2s ease-in-out infinite}.se7-modular-pulse{animation:se7ModularPulse 2s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.se7-modular-hourglass,.se7-modular-pulse{animation:none}}';
    document.head.append(style);
   }
   const cardRows=new Map();
   const pill=(label,ok)=>{const node=action((ok?'✓ ':'○ ')+label,()=>{});node.className='inline-flex items-center rounded-md px-2 py-1 text-xs border cursor-pointer '+(ok?'bg-blue-900/60 text-sky-300 border-sky-700/60':'bg-slate-700/60 text-slate-300 border-slate-600');return node;};
   const display=(row,data)=>{
    row.badges.replaceChildren();
    const audit=Array.isArray(data?.audit)?data.audit:[];
    const ok=id=>audit.some(rule=>rule.id===id&&rule.ok===true);
    const pdf=ok('pdf-link')&&ok('pdf-https')&&ok('pdf-size');
    const videos=[1,2,3].every(i=>ok('lesson-'+i+'-title')&&ok('lesson-'+i+'-link'))&&ok('lessons-count');
    const exam=['exam-record','exam-published','exam-count','exam-choices','exam-answer-keys'].every(ok);
    const items=[['Apostila',pdf,'apostila'],['3 videoaulas',videos,'videos'],['Avaliação',exam,'exam']];for(const [label,ok,kind] of items){const button=pill(label,ok);button.onclick=()=>window.se7ModularAvaModal(row.subjectId,kind);row.badges.append(button);}
    const started=audit.some(rule=>['syllabus','pdf-link','lesson-1-link','lesson-2-link','lesson-3-link','exam-record'].includes(rule.id)&&rule.ok);
    const complete=data?.ready===true;
    row.state.replaceChildren();
    const icon=element('span',complete?'✓':started?'⌛':'✕');
    icon.setAttribute('aria-hidden','true');
    const text=element('span',complete?'Configurada':started?'Em preparação':'Não configurada');
    row.state.className='inline-flex items-center gap-2 text-xs font-semibold '+(complete?'text-emerald-400':started?'text-amber-300':'text-rose-300');
    if(!complete){icon.className=started?'se7-modular-hourglass':'se7-modular-pulse';text.className='se7-modular-pulse';}
    row.state.append(icon,text);
   };
   subjects.forEach((subject,i)=>{
    const card=element('div');
    card.className='w-full text-left flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-600 bg-slate-800 text-white p-4 hover:bg-slate-700';
    const left=element('span');left.className='flex flex-col gap-2';
    left.append(element('strong',subject.name||subject.nome||'Disciplina '+(i+1)));
    const badges=element('span');badges.className='flex flex-wrap gap-2';
    for(const [label,kind] of [['Apostila','apostila'],['3 videoaulas','videos'],['Avaliação','exam']]){const btn=action(label,()=>window.se7ModularAvaModal(subject.id,kind));btn.className='rounded-md px-2 py-1 text-xs border border-slate-600 bg-slate-700/60 text-slate-300';badges.append(btn);}left.append(badges);
    const right=element('span');right.className='flex items-center gap-3';
    const state=element('span','Verificando...');state.className='text-xs text-slate-400';
    right.append(state);card.append(left,right);list.append(card);
    cardRows.set(String(subject.id),{badges,state,subjectId:subject.id});
   });
   se7ReadinessCached(c.id).then(result=>{
    if(sequence!==avaLoadSequence||current()?.id!==c.id)return;
    const data=new Map((result.subjects||[]).map(item=>[String(item.subjectId),item]));
    for(const [id,row]of cardRows){const subject=data.get(id);if(subject)display(row,subject);else row.state.textContent='Status indisponível';}
   }).catch(err=>{
    if(sequence!==avaLoadSequence)return;
    for(const row of cardRows){row.badges.replaceChildren();row.badges.append(element('small','Não foi possível verificar'));row.state.textContent='Status indisponível';}
    console.warn('EJA Modular: falha ao consultar preparação',err);
   });
  }
  document.addEventListener('se7-modular-materials-saved',()=>{readinessCache.clear();if(!panels.ava.hidden)renderSubjects();});
  function renderStudents(){
   tbody.replaceChildren();const c=current();
   const items=(typeof students==='undefined'?[]:students).filter(s=>String(s.courseId)===String(c?.id)).sort((a,b)=>String(a.fullname||'').localeCompare(String(b.fullname||''),'pt-BR'));
   if(!items.length){const tr=element('tr'),td=element('td','Nenhum aluno EJA Modular matriculado.');td.colSpan=5;td.className='p-5 text-center text-slate-400';tr.append(td);tbody.append(tr);return;}
   items.forEach(s=>{
    const tr=element('tr');tr.className='border-b border-slate-700';
    const cls=(typeof classes==='undefined'?[]:classes).find(x=>String(x.id)===String(s.classId));
    for(const val of [s.code||'—',s.fullname||'Aluno',cls?.name||'Sem turma',s.status||'Ativo']){
     const td=element('td',val);td.className='p-3';tr.append(td);
    }
    const td=element('td');td.className='p-3 text-right whitespace-nowrap';
    if(window.SE7PortalPreview?.allowed()){
     const portal=action('Ver portal',()=>{const target=document.createElement('button');target.dataset.previewStudent=String(s.id);document.body.append(target);target.click();target.remove();});
     portal.dataset.previewStudent=String(s.id);portal.className='px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs mr-2';td.append(portal);
    }
    const edit=action('Editar',()=>{if(typeof editarAluno==='function')editarAluno(s.id);});td.append(edit);tr.append(td);tbody.append(tr);
   });
  }
  window.se7ModularRenderStudents=renderStudents;
  activate('students');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
