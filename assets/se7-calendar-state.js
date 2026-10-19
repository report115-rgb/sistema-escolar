/* Estado visual local das datas; não consulta nem grava no banco de dados. */
(()=>{'use strict';
 const parts=date=>Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
 const today=(date=new Date())=>{const p=parts(date);return p.year+'-'+p.month+'-'+p.day;};
 const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 const isPast=(date,now=new Date())=>valid(date)&&date<today(now);
 const attributes=(date,now=new Date())=>valid(date)?'data-se7-calendar-date="'+date+'" data-se7-calendar-past="'+isPast(date,now)+'"':'';
 function refresh(root=document){const day=today(),nodes=[...(root.matches?.('[data-se7-calendar-date]')?[root]:[]),...(root.querySelectorAll?.('[data-se7-calendar-date]')||[])];for(const node of nodes){const value=String(valid(node.dataset.se7CalendarDate)&&node.dataset.se7CalendarDate<day);if(node.dataset.se7CalendarPast!==value)node.dataset.se7CalendarPast=value;}}
 globalThis.SE7CalendarState={today,isPast,attributes,refresh};
 if(typeof document==='undefined')return;
 let timer;function schedule(){clearTimeout(timer);const p=parts(new Date()),seconds=(23-Number(p.hour))*3600+(59-Number(p.minute))*60+60-Number(p.second);timer=setTimeout(()=>{refresh();schedule();},Math.max(1000,seconds*1000+100));}
 function start(){refresh();schedule();const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&(node.matches('[data-se7-calendar-date]')||node.querySelector('[data-se7-calendar-date]')))refresh(node);});observer.observe(document.body,{childList:true,subtree:true});}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();schedule();}});window.addEventListener('pageshow',()=>{refresh();schedule();});window.addEventListener('focus',()=>{refresh();schedule();});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
