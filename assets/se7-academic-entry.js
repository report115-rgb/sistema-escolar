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
