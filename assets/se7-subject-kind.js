(function(root){
 const labels={theory:'Teórica',theory_practice:'Teórico-prática',internship:'Estágio curricular obrigatório',tcc:'TCC'};
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const supports=c=>!(/eja|supletivo/i.test(String(c?.nivel||'')+' '+String(c?.name||''))&&c?.ejaMode!=='modular');
 const moduleOf=event=>{const n=Number(event?.module)||Number(String(event?.description||'').match(/m[oó]dulo\s*0?([1-4])\b/i)?.[1]);return [1,2,3,4].includes(n)?String(n):'';};
 function description(event,course){if(event.eventType&&event.eventType!=='lesson')return event.description||event.subject||'Evento';const subject=course?.subjects?.find(s=>normalize(s.name)===normalize(event.subject)),kind=labels[subject?.teachingType],mod=moduleOf(event);return [kind,mod?'Módulo '+mod:''].filter(Boolean).join(' • ')||event.description||'Aula programada';}
 const displayName=subject=>{const name=String(subject?.name||'').trim();return subject?.teachingType==='tcc'&&!/^TCC\s*[-–—]/i.test(name)?'TCC - '+name:name;};
 root.SE7SubjectKind={labels,supports,moduleOf,description,displayName};
})(typeof window!=='undefined'?window:globalThis);
