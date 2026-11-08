(function(){
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const styles={card:'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3',button:'px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-semibold',muted:'text-xs text-slate-500 dark:text-slate-400',row:'flex items-center justify-between gap-3'};

function examPanel(detail,subject,info){
 const area=el('section');area.className='space-y-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700';detail.append(area);
 const start=el('button','Consultar / realizar avaliação');start.type='button';start.className=styles.button;area.append(start);
 const state=el('p','A prova abre às 08h e encerra no prazo informado, sem tolerância. Apenas respostas enviadas são registradas.');state.className=styles.muted;area.append(state);
 let timer=null,attempt=null,busy=false,closed=false;
 const call=(operation,extra={})=>SE7.api('eja-modular-student-exam',{subjectId:String(subject.id),operation,...extra});
 const stop=()=>{if(timer){clearInterval(timer);timer=null;}};
 const expiry=()=>{if(!attempt?.window?.closes)return null;return new Date(attempt.window.closes.slice(0,10)+'T'+attempt.window.closes.slice(11,19)+'-03:00').getTime()+999;};
 const lock=async()=>{if(closed)return;closed=true;stop();state.textContent='Prazo encerrado. Apenas as respostas enviadas até o horário limite serão consideradas.';area.querySelectorAll('input,button').forEach(x=>x.disabled=true);try{const latest=await call('read');state.textContent=latest.status==='expired'?'Prazo encerrado. Respostas registradas: '+(latest.submittedCount||0)+'/10.':latest.status==='completed'?'Avaliação concluída. Nota: '+latest.grade:'Prazo encerrado. Nenhuma resposta adicional será aceita.';}catch{}};
 const renderAttempt=data=>{
  attempt=data;area.querySelectorAll('[data-exam-content]').forEach(x=>x.remove());closed=false;stop();
  const content=el('div');content.dataset.examContent='true';content.className='space-y-3';area.append(content);
  const status=String(data.status||'');
  if(status==='completed'||status==='expired'){state.textContent=(status==='completed'?'Avaliação concluída. ':'Prazo encerrado. ')+'Respostas enviadas: '+(data.submittedCount||0)+'/10. Nota: '+(data.grade??'não disponível')+'.';start.disabled=true;return;}
  if(status==='scheduled'){state.textContent='Avaliação ainda não liberada. Abertura: '+(data.window?.opens||'a confirmar')+' (Belém/PA).';return;}
  if(!Array.isArray(data.questions)||data.questions.length!==10){state.textContent='Avaliação indisponível. Consulte a secretaria.';return;}
  start.hidden=true;
  const counter=el('p');counter.className=styles.muted;content.append(counter);
  const deadline=expiry();
  const refresh=()=>{if(deadline!==null&&Date.now()>deadline){lock();return;}const remaining=deadline===null?0:Math.max(0,Math.ceil((deadline-Date.now())/1000));const h=Math.floor(remaining/3600),m=Math.floor(remaining%3600/60),s=remaining%60;counter.textContent='Enviadas: '+Object.keys(attempt.answers||{}).length+'/10 · Prazo: '+(data.window?.closes||'')+' · Tempo restante: '+h+'h '+String(m).padStart(2,'0')+'m '+String(s).padStart(2,'0')+'s';};
  data.questions.forEach((q,index)=>{
   const card=el('div');card.className='p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2';
   const heading=el('strong',(index+1)+'. '+String(q.enunciado||''));card.append(heading);
   if(q.imagem){const img=el('img');img.src=q.imagem;img.alt='Imagem da questão '+(index+1);img.className='max-w-full rounded-lg';card.append(img);}
   const sent=Object.prototype.hasOwnProperty.call(data.answers||{},String(index));
   const choices=[];
   (q.opcoes||[]).forEach((option,j)=>{const line=el('label');line.className='flex gap-2 items-start text-sm';const radio=el('input');radio.type='radio';radio.name='modular-'+String(subject.id)+'-'+index;radio.value=String(j);radio.checked=sent&&data.answers[String(index)]===j;radio.disabled=sent;const label=el('span',String(option));line.append(radio,label);card.append(line);choices.push(radio);});
   const send=el('button',sent?'Resposta enviada':'Enviar resposta');send.type='button';send.className=styles.button;send.disabled=sent;
   const feedback=el('p',sent?'Registrada no sistema.':'');feedback.className=styles.muted;
   send.onclick=async()=>{const selected=choices.find(x=>x.checked);if(!selected){feedback.textContent='Selecione uma alternativa antes de enviar.';return;}if(busy||closed)return;busy=true;send.disabled=true;feedback.textContent='Enviando resposta...';try{const updated=await call('submit',{index,answer:Number(selected.value)});if(updated.status!=='in_progress'){renderAttempt(updated);return;}attempt=updated;choices.forEach(x=>x.disabled=true);send.textContent='Resposta enviada';feedback.textContent='Resposta registrada com sucesso.';refresh();}catch(e){feedback.textContent=e?.message||'Falha ao enviar. Tente novamente.';if(deadline!==null&&Date.now()>deadline)lock();else send.disabled=false;}finally{busy=false;}};
   card.append(send,feedback);content.append(card);
  });
  const finish=el('button','Finalizar avaliação');finish.type='button';finish.className=styles.button;content.append(finish);
  finish.onclick=async()=>{if(busy||closed)return;if(Object.keys(attempt.answers||{}).length!==10){state.textContent='Envie todas as dez respostas para finalizar. O prazo continua correndo.';return;}if(!confirm('Finalizar definitivamente esta avaliação?'))return;busy=true;finish.disabled=true;state.textContent='Aguarde, salvando avaliação...';try{renderAttempt(await call('finish'));}catch(e){state.textContent=e?.message||'Falha ao finalizar. Confira o prazo e tente novamente.';finish.disabled=false;}finally{busy=false;}};
  refresh();timer=setInterval(refresh,1000);
 };
 start.onclick=async()=>{start.disabled=true;state.textContent='Consultando avaliação...';try{renderAttempt(await call('read'));}catch(e){state.textContent=e?.message||'Não foi possível abrir a avaliação.';}finally{start.disabled=false;}};
 return {stop};
}

function render(course,student){
 const home=document.getElementById('tab-home');if(!home)return;
 let root=document.getElementById('se7-modular-ava');if(!root){root=el('section');root.id='se7-modular-ava';root.className='space-y-3 my-4';home.prepend(root);}
 root.replaceChildren();
 const snapshotRequest=SE7.api('eja-modular-student-snapshot',{courseId:course.id});
 root.append(el('h2','Minhas disciplinas — EJA Modular'));
 const note=el('p','As aulas e avaliações serão liberadas após a confirmação do pagamento inicial e a ativação do cronograma acadêmico.');note.className=styles.muted;root.append(note);
 const subjects=Array.isArray(course?.subjects)?course.subjects:[];
 snapshotRequest.then(data=>{if(!root.isConnected)return;if(!data.active){note.textContent=data.reason||'Aguardando ativação acadêmica.';return;}note.textContent='Cronograma acadêmico confirmado. Consulte as datas de cada disciplina. Acesse os materiais e as avaliações de cada disciplina conforme as datas de liberação.';const byId=new Map(data.subjects.map(s=>[String(s.subjectId),s]));root.querySelectorAll('[data-modular-subject-id]').forEach(card=>{const plan=byId.get(card.dataset.modularSubjectId);if(!plan)return;const status=card.querySelector('[data-modular-status]');if(status)status.textContent=plan.examWindow?.expired?'Prazo da prova encerrado':plan.available?'Cronograma iniciado — atividades em integração':'Liberação em '+plan.releaseDate;
 const schedule=card.querySelector('[data-modular-schedule]');if(schedule){schedule.replaceChildren();const lines=[['Ciclo',String(plan.cycle||'—')],['Apostila e videoaula 1',plan.releaseDate],['Videoaula 2',plan.lessons?.[1]?.releaseDate||'—'],['Videoaula 3',plan.lessons?.[2]?.releaseDate||'—'],['Prova será liberada a partir de',plan.examEarliestDate+' às 08:00'],['Prazo final da prova',plan.examCloseAt?plan.examCloseAt.slice(0,10)+' às 23:59':'Não disponível']];for(const [label,date] of lines){const line=el('p',label+': '+date);line.className=styles.muted;schedule.append(line);}}});}).catch(()=>{if(root.isConnected)note.textContent='Não foi possível consultar o cronograma. Nenhuma atividade foi liberada.';});
 if(!subjects.length){root.append(el('p','Nenhuma disciplina cadastrada.'));return;}
 const overall=el('p','Progresso geral: aguardando início do curso');overall.className=styles.muted;root.append(overall);
 subjects.forEach((subject,index)=>{
  const card=el('article');card.className=styles.card;card.dataset.modularSubjectId=String(subject.id||'');
  const head=el('div');head.className=styles.row;
  const title=el('strong',(subject.name||subject.nome||'Disciplina '+(index+1)));const status=el('span','Aguardando liberação');status.className=styles.muted;status.dataset.modularStatus='true';head.append(title,status);card.append(head);
  const progress=el('p','Progresso: ainda não verificado');progress.className=styles.muted;card.append(progress);
  const schedule=el('div');schedule.dataset.modularSchedule='true';schedule.className='space-y-1';card.append(schedule);
  const button=el('button','Abrir disciplina');button.type='button';button.className=styles.button;button.setAttribute('aria-expanded','false');
  const detail=el('div');detail.hidden=true;detail.className='space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700';
  const list=[['Apostila PDF','Aguardando liberação'],['Videoaula 1','Aguardando liberação'],['Videoaula 2','Aguardando liberação'],['Videoaula 3','Aguardando liberação'],['Avaliação final','Aguardando liberação']];
  list.forEach(([name,state])=>{const row=el('div');row.className=styles.row;const label=el('span',name);label.className='text-sm';const value=el('span',state);value.className=styles.muted;row.append(label,value);detail.append(row);});
  const info=el('p','A avaliação respeita rigorosamente as datas e horários exibidos.');info.className=styles.muted;detail.append(info);
  const materialsButton=el('button','Consultar materiais liberados');materialsButton.type='button';materialsButton.className=styles.button;materialsButton.onclick=async()=>{materialsButton.disabled=true;info.textContent='Consultando materiais...';try{const data=await SE7.api('eja-modular-student-materials',{subjectId:String(subject.id)});const links=el('div');links.className='space-y-2';const addLink=(name,url)=>{if(!url)return;const a=el('a',name);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.className='block text-blue-600 underline';links.append(a);};addLink('Abrir apostila PDF',data.apostilaUrl);for(const lesson of data.lessons||[])addLink('Abrir videoaula '+lesson.number+' — '+lesson.title,lesson.url);detail.append(links);materialsButton.remove();info.textContent='Somente materiais com data de liberação alcançada estão disponíveis.';}catch(e){info.textContent=e?.message||'Materiais indisponíveis. Tente novamente.';materialsButton.disabled=false;}};detail.append(materialsButton);
  examPanel(detail,subject,info);
  button.onclick=()=>{const opening=detail.hidden;root.querySelectorAll('article > div[data-modular-detail]').forEach(d=>{d.hidden=true;const b=d.parentElement.querySelector('button');if(b){b.textContent='Abrir disciplina';b.setAttribute('aria-expanded','false');}});detail.hidden=!opening;button.textContent=opening?'Fechar disciplina':'Abrir disciplina';button.setAttribute('aria-expanded',String(opening));};
  detail.dataset.modularDetail='true';card.append(button,detail);root.append(card);
 });
}
window.SE7ModularAVA={render};
})();
