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
 const dialog=document.createElement('dialog');dialog.className='eja-modal-prova';dialog.style.cssText='padding:22px;max-height:90dvh;overflow:auto;width:min(95vw,680px)';
 const title=document.createElement('h3');title.className='font-bold text-lg mb-2';title.textContent='Valores e mensalidades — EJA Modular';dialog.append(title);
 const note=document.createElement('p');note.className='text-xs mb-4';note.textContent='Defina o valor total do curso. O sistema calcula as mensalidades de 3, 6 e 9 meses. A configuração não cria cobranças e não altera contratos existentes.';dialog.append(note);
 const label=document.createElement('label');label.className='block text-sm font-semibold';label.textContent='Valor total do curso (R$)';const input=document.createElement('input');input.type='text';input.inputMode='decimal';input.placeholder='Ex.: 1800,00';input.className='block w-full p-3 mt-2 rounded-lg border dark:bg-slate-800';label.append(input);dialog.append(label);
 const preview=document.createElement('div');preview.className='my-4 space-y-2';dialog.append(preview);
 const msg=document.createElement('p');msg.className='text-xs my-3';dialog.append(msg);
 const actions=document.createElement('div');actions.className='flex gap-2';
 const save=document.createElement('button');save.type='button';save.className='px-4 py-2 rounded bg-emerald-700 text-white';save.textContent='Salvar valor total';actions.append(save);
 const close=document.createElement('button');close.type='button';close.className='px-4 py-2 rounded bg-slate-600 text-white';close.textContent='Fechar';close.onclick=()=>dialog.close();actions.append(close);dialog.append(actions);
 dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
 const money=cents=>(cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const parse=()=>{const raw=input.value.trim().replace(/^R\$\s*/,'').replace(/\./g,'').replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null;const cents=Math.round(Number(raw)*100);return Number.isSafeInteger(cents)&&cents>0&&cents<=100000000?cents:null;};
 const show=()=>{preview.replaceChildren();const cents=parse();save.disabled=!cents;save.style.opacity=cents?'1':'.5';if(!cents){msg.textContent='Informe um valor total válido para calcular as mensalidades.';return;}msg.textContent='Prévia calculada. Diferenças de centavos são distribuídas entre as primeiras parcelas.';[3,6,9].forEach(months=>{const base=Math.floor(cents/months),extra=cents%months;const row=document.createElement('p');row.className='rounded-lg border dark:border-slate-600 p-3 text-sm';row.textContent=months+' meses: '+(extra?extra+' parcela(s) de '+money(base+1)+' e '+(months-extra)+' de '+money(base):months+' parcelas de '+money(base))+' — Total '+money(cents);preview.append(row);});};
 input.oninput=show;try{const data=await SE7.api('eja-modular-tuition',{operation:'read',courseId});if(data.totalCents!==null)input.value=(data.totalCents/100).toFixed(2).replace('.',',');show();}catch(e){msg.textContent='Erro ao consultar valores: '+e.message;}
 save.onclick=async()=>{const cents=parse();if(!cents)return;save.disabled=true;try{await SE7.api('eja-modular-tuition',{operation:'save',courseId,totalCents:cents});msg.textContent='Valor total salvo. As mensalidades foram recalculadas para 3, 6 e 9 meses.';}catch(e){msg.textContent='Não foi possível salvar: '+e.message;}finally{show();}};
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


/* Organização pedagógica do EJA Modular: AVA por disciplina e Configurações. */
(function(){
 const byId=id=>document.getElementById(id);
 const el=(tag,label)=>{const n=document.createElement(tag);if(label!==undefined)n.textContent=label;return n;};
 const btn=(label,action)=>{const n=el('button',label);n.type='button';n.className='px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold';n.onclick=action;return n;};
 const currentCourse=()=>{const id=byId('se7-gestao-modular-curso')?.value;return typeof courses==='undefined'?null:courses.find(c=>String(c.id)===String(id)&&c.ejaMode==='modular');};
 function initialize(){
  const root=byId('subeja-modular'),select=byId('se7-gestao-modular-curso');
  if(!root||!select||byId('se7-modular-inner-tabs'))return;
  const section=root.querySelector('section');if(!section)return;
  const oldActions=section.querySelector('div.flex.flex-wrap.gap-2');
  if(oldActions)oldActions.hidden=true;
  const heading=section.querySelector('h4');if(heading)heading.textContent='EJA Modular';
  const description=section.querySelector('h4 + p');if(description)description.textContent='Organize materiais e avaliações no AVA ou ajuste os parâmetros em Configurações.';
  const tabs=el('div');tabs.id='se7-modular-inner-tabs';tabs.className='flex flex-wrap gap-2 border-b border-slate-600 pb-3';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Áreas do EJA Modular');
  const avaTab=btn('AVA',()=>activate('ava')),configTab=btn('Configurações',()=>activate('config'));
  avaTab.setAttribute('role','tab');configTab.setAttribute('role','tab');tabs.append(avaTab,configTab);
  const ava=el('div');ava.id='se7-modular-ava';ava.className='space-y-3';
  const config=el('div');config.id='se7-modular-config';config.className='space-y-3';
  const intro=el('p','Disciplinas cadastradas no curso. Selecione uma disciplina para gerenciar sua apostila, videoaulas e avaliação.');intro.className='text-sm text-slate-500 dark:text-slate-300';ava.append(intro);
  const list=el('div');list.id='se7-modular-disciplines';list.className='grid gap-3';ava.append(list);
  const configActions=el('div');configActions.className='flex flex-wrap gap-2';
  [['Plano financeiro do aluno','plano-financeiro'],['Valores e mensalidades','financeiro'],['Verificar preparação','diagnostico'],['Simular AVA','simulador']].forEach(([label,type])=>configActions.append(btn(label,()=>window.se7GestaoModularAbrir(type))));
  config.append(el('p','Parâmetros administrativos, condições financeiras e ferramentas de conferência do EJA Modular.'),configActions);
  section.insertBefore(tabs,select.parentElement);
  section.insertBefore(ava,select.parentElement.nextSibling);
  section.insertBefore(config,ava.nextSibling);
  function activate(which){const on=which==='ava';ava.hidden=!on;config.hidden=on;avaTab.setAttribute('aria-selected',String(on));configTab.setAttribute('aria-selected',String(!on));for(const [tab,active] of [[avaTab,on],[configTab,!on]]){tab.classList.toggle('bg-blue-700',active);tab.classList.toggle('bg-slate-700',!active);}if(on)render();}
  function render(){
   list.replaceChildren();const course=currentCourse();
   if(!course){list.append(el('p','Selecione um curso EJA Modular para visualizar as disciplinas.'));return;}
   const subjects=Array.isArray(course.subjects)?course.subjects:[];
   if(!subjects.length){list.append(el('p','Nenhuma disciplina vinculada a este curso. Cadastre as disciplinas em Sistema > Disciplinas e vincule-as ao curso.'));return;}
   subjects.forEach((subject,i)=>{
    const card=el('details');card.className='rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-4';
    const summary=el('summary',(subject.name||subject.nome||'Disciplina '+(i+1)));summary.className='cursor-pointer font-semibold';card.append(summary);
    const help=el('p','Gerencie os links da apostila e das videoaulas no cadastro de materiais. A prova é editada no cadastro de avaliações da disciplina.');help.className='text-xs text-slate-500 dark:text-slate-300 my-3';card.append(help);
    const actions=el('div');actions.className='flex flex-wrap gap-2';
    actions.append(btn('Apostila e videoaulas',()=>window.se7GestaoModularAbrir('materiais')));
    actions.append(btn('Editar prova',()=>{
      window.se7GestaoModularAbrir('avaliacoes');
      const subjectId=String(subject.id||'');
      if(subjectId){const timer=setInterval(()=>{const dialogs=[...document.querySelectorAll('dialog[open]')];const dialog=dialogs.find(d=>d.querySelector('select')?.options?.length>1&&d.textContent.includes('Avaliações EJA Modular'));const field=dialog?.querySelector('select');if(field){clearInterval(timer);if([...field.options].some(o=>o.value===subjectId)){field.value=subjectId;field.dispatchEvent(new Event('change'));}}},50);setTimeout(()=>clearInterval(timer),1200);}
    }));
    card.append(actions);list.append(card);
   });
  }
  select.addEventListener('change',render);
  const previous=window.se7GestaoModularAtualizar;
  if(typeof previous==='function')window.se7GestaoModularAtualizar=function(...args){const result=previous.apply(this,args);render();return result;};
  activate('ava');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
