(function(){
const modularCourses=()=>typeof courses==='undefined'?[]:courses.filter(c=>c.nivel==='Supletivo'&&c.ejaMode==='modular');
window.se7GestaoModularAtualizar=function(){const select=document.getElementById('se7-gestao-modular-curso');if(!select)return;const previous=select.value;select.replaceChildren(new Option('Selecione o curso',''));modularCourses().forEach(c=>select.add(new Option(c.name||'EJA Modular',c.id)));if(modularCourses().some(c=>c.id===previous))select.value=previous;const note=document.getElementById('se7-gestao-modular-aviso');if(note)note.textContent=select.value?'Escolha a operação acima.':'Selecione um curso EJA Modular cadastrado em Cursos.';};
window.se7GestaoModularDiagnostico=async function(courseId){
 const area=document.getElementById('se7-gestao-modular-aviso');if(!area)return;area.replaceChildren();
 const loading=document.createElement('p');loading.textContent='Verificando materiais, links, questões e publicação...';area.append(loading);
 try{const data=await SE7.api('eja-modular-readiness',{courseId});if(document.getElementById('se7-gestao-modular-curso')?.value!==courseId)return;area.replaceChildren();
 const title=document.createElement('strong');title.textContent='Preparação: '+data.readyCount+'/'+data.total+' disciplinas • '+data.issueCount+' pendências';area.append(title);
 const audit=document.createElement('p');audit.className='text-sm font-semibold my-2';audit.textContent='Checklist pedagógico: '+data.auditPassed+' de '+data.auditTotal+' verificações atendidas';area.append(audit);
 const note=document.createElement('p');note.textContent=data.note;note.className='my-2';area.append(note);
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
window.se7GestaoModularAbrir=function(type){const id=document.getElementById('se7-gestao-modular-curso')?.value;const course=modularCourses().find(c=>c.id===id);if(!course){alert('Selecione um curso EJA Modular.');return;}if(type==='materiais')return window.se7AbrirMateriaisModulares(id);if(type==='avaliacoes')return window.se7AbrirAvaliacaoModular(id);if(type==='diagnostico')return window.se7GestaoModularDiagnostico(id);if(type!=='simulador')return;
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
