(function(){
const modularCourses=()=>typeof courses==='undefined'?[]:courses.filter(c=>c.nivel==='Supletivo'&&c.ejaMode==='modular');
window.se7GestaoModularAtualizar=function(){const select=document.getElementById('se7-gestao-modular-curso');if(!select)return;const previous=select.value;select.replaceChildren(new Option('Selecione o curso',''));modularCourses().forEach(c=>select.add(new Option(c.name||'EJA Modular',c.id)));if(modularCourses().some(c=>c.id===previous))select.value=previous;const note=document.getElementById('se7-gestao-modular-aviso');if(note)note.textContent=select.value?'Escolha a operação acima.':'Selecione um curso EJA Modular cadastrado em Cursos.';};
window.se7GestaoModularAbrir=function(type){const id=document.getElementById('se7-gestao-modular-curso')?.value;const course=modularCourses().find(c=>c.id===id);if(!course){alert('Selecione um curso EJA Modular.');return;}if(type==='materiais')return window.se7AbrirMateriaisModulares(id);if(type==='avaliacoes')return window.se7AbrirAvaliacaoModular(id);if(type!=='simulador')return;
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
