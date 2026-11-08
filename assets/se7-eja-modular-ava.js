(function(){
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const styles={card:'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3',button:'px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-semibold',muted:'text-xs text-slate-500 dark:text-slate-400',row:'flex items-center justify-between gap-3'};
function render(course,student){
 const home=document.getElementById('tab-home');if(!home)return;
 let root=document.getElementById('se7-modular-ava');if(!root){root=el('section');root.id='se7-modular-ava';root.className='space-y-3 my-4';home.prepend(root);}
 root.replaceChildren();
 const snapshotRequest=SE7.api('eja-modular-student-snapshot',{courseId:course.id});
 root.append(el('h2','Minhas disciplinas — EJA Modular'));
 const note=el('p','As aulas e avaliações serão liberadas após a confirmação do pagamento inicial e a ativação do cronograma acadêmico.');note.className=styles.muted;root.append(note);
 const subjects=Array.isArray(course?.subjects)?course.subjects:[];
 snapshotRequest.then(data=>{if(!root.isConnected)return;if(!data.active){note.textContent=data.reason||'Aguardando ativação acadêmica.';return;}note.textContent='Cronograma acadêmico confirmado. Consulte as datas de cada disciplina. Materiais e avaliações permanecem bloqueados até a integração das atividades.';const byId=new Map(data.subjects.map(s=>[String(s.subjectId),s]));root.querySelectorAll('[data-modular-subject-id]').forEach(card=>{const plan=byId.get(card.dataset.modularSubjectId);if(!plan)return;const status=card.querySelector('[data-modular-status]');if(status)status.textContent=plan.available?'Cronograma iniciado — atividades em integração':'Liberação em '+plan.releaseDate;
 const schedule=card.querySelector('[data-modular-schedule]');if(schedule){schedule.replaceChildren();const lines=[['Ciclo',String(plan.cycle||'—')],['Apostila e videoaula 1',plan.releaseDate],['Videoaula 2',plan.lessons?.[1]?.releaseDate||'—'],['Videoaula 3',plan.lessons?.[2]?.releaseDate||'—'],['Avaliação — data mínima',plan.examEarliestDate]];for(const [label,date] of lines){const line=el('p',label+': '+date);line.className=styles.muted;schedule.append(line);}}});}).catch(()=>{if(root.isConnected)note.textContent='Não foi possível consultar o cronograma. Nenhuma atividade foi liberada.';});
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
  const info=el('p','Os conteúdos e a avaliação ainda não estão disponíveis para esta matrícula.');info.className=styles.muted;detail.append(info);
  button.onclick=()=>{const opening=detail.hidden;root.querySelectorAll('article > div[data-modular-detail]').forEach(d=>{d.hidden=true;const b=d.parentElement.querySelector('button');if(b){b.textContent='Abrir disciplina';b.setAttribute('aria-expanded','false');}});detail.hidden=!opening;button.textContent=opening?'Fechar disciplina':'Abrir disciplina';button.setAttribute('aria-expanded',String(opening));};
  detail.dataset.modularDetail='true';card.append(button,detail);root.append(card);
 });
}
window.SE7ModularAVA={render};
})();
