/* Ajustes visuais do Matriz. Não realiza gravações no Firebase. */
const se7ModulosMatriz={
 'tab-portal-admin':['Portal do Aluno','Gerencie os avisos do portal e acompanhe os acessos dos alunos.'],
 'tab-gestion-students':['Gestão de Alunos','Organize cadastros e acompanhe a documentação acadêmica.'],
 'tab-gestao-eja':['Gestão EJA','Gerencie apostilas, provas e documentação dos alunos EJA.'],
 'tab-students':['Matrícula','Realize matrículas, cancelamentos e reativação de matrícula.'],
 'tab-attendance':['Notas e frequência','Registre a frequência e lance as notas dos alunos.'],
 'tab-se7-exams':['Gestão de Avaliações','Consulte avaliações e organize a impressão e a correção das provas.'],
 'tab-grades':['Notas','Organize avaliações e acompanhe o desempenho acadêmico.'],
 'tab-student-finance':['Financeiro','Acompanhe cobranças e informações financeiras dos alunos.'],
 'tab-history':['Emissão de Documentos','Emita declarações, contratos e históricos acadêmicos.'],
 'tab-controle-ponto-manual':['Ponto Manual','Registre e consulte os horários dos professores.'],
 'tab-settings':['Sistema','Gerencie cursos, turmas e configurações da instituição.']
};
function atualizarModuloMatriz(id){const [title,description]=se7ModulosMatriz[id]||['Sistema Matriz','Tudo conectado ao sistema Matriz'];document.getElementById('se7-page-title').textContent=title;document.getElementById('se7-page-description').textContent=description;atualizarCabecalhoMatriz(id);}
function atualizarCabecalhoMatriz(id){let user={};try{user=JSON.parse(sessionStorage.getItem('usuario_logado')||'{}');}catch{}const role=document.getElementById('se7-header-role');if(role)role.textContent=({master:'Master',secretaria:'Secretaria',professor:'Professor',financeiro:'Financeiro'}[user.perfil]||'Usuário');}

function alternarMenuMatriz(){const collapsed=document.body.classList.toggle('se7-sidebar-collapsed');const button=document.getElementById('se7-sidebar-toggle');button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'Expandir menu lateral':'Recolher menu lateral');try{localStorage.setItem('se7-matriz-sidebar',collapsed?'collapsed':'expanded');}catch{}window.dispatchEvent(new Event('resize'));}
window.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('#main-tabs-nav .tab-button').forEach(button=>{button.title=button.textContent.trim();button.setAttribute('aria-label',button.textContent.trim());if(button.classList.contains('active'))button.setAttribute('aria-current','page');});try{if(localStorage.getItem('se7-matriz-sidebar')==='collapsed')alternarMenuMatriz();}catch{}atualizarCabecalhoMatriz();});

/* Auditoria de ações explícitas e gravações realizadas pelo Matriz. */
(()=>{
 let installed=false,clickInstalled=false;
 const modules={students:'Gestão de Alunos',courses:'Cursos / Disciplinas',classes:'Turmas',academicCalendars:'Calendário Acadêmico',teachers:'Colaboradores',teacherManualLogs:'Ponto Manual',teacherMonthlyPayments:'Pagamentos de Colaboradores',config:'Configurações',financeLogs:'Financeiro',attendanceRecords:'Frequência',attendance:'Frequência',attendanceLocks:'Frequência',employeeLogs:'Ponto de Colaboradores',teacherPaymentRates:'Valores de Hora-aula',pendingUsers:'Acessos',systemUsers:'Acessos'};
 const tracked=path=>Boolean(modules[String(path||'').split('/')[0]]);
 const log=(operation,path)=>{if(!tracked(path)||typeof registrarLogAuditoria!=='function')return;void registrarLogAuditoria(operation+' — registro '+path,modules[path.split('/')[0]]);};
 window.iniciarAuditoriaMovimentacoes=()=>{
  if(!clickInstalled){clickInstalled=true;document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled||b.closest('#login-modal'))return;let session;try{session=JSON.parse(sessionStorage.getItem('usuario_logado')||'{}');}catch{return;}if(!['master','secretaria','professor','financeiro'].includes(session.perfil))return;const label=(b.getAttribute('aria-label')||b.title||b.textContent||'').trim().replace(/\s+/g,' ').slice(0,160);if(label&&typeof registrarLogAuditoria==='function'){const title=document.getElementById('se7-page-title')?.textContent||'Sistema Matriz';void registrarLogAuditoria('Acionou: '+label,title);}},true);}
  if(installed||typeof db==='undefined'||!db)return;
  const ref=db.collection('teachers').doc('__audit_probe__'),collection=db.collection('teachers');
  function wrap(proto,method,operation,pathOf){const original=proto[method];if(typeof original!=='function'||original.se7AuditWrapped)return;const wrapped=async function(...args){const result=await original.apply(this,args);log(operation,pathOf(this,result));return result;};wrapped.se7AuditWrapped=true;proto[method]=wrapped;}
  const proto=Object.getPrototypeOf(ref);for(const [method,text]of [['set','Gravou dados'],['update','Atualizou dados'],['delete','Excluiu dados']])wrap(proto,method,text,r=>r.path);
  wrap(Object.getPrototypeOf(collection),'add','Cadastrou registro',(r,result)=>result?.path||r.path);
  const batchProto=Object.getPrototypeOf(db.batch());for(const method of ['set','update','delete']){const original=batchProto[method];if(!original||original.se7AuditWrapped)continue;const fn=function(ref,...args){(this.__se7AuditWrites??=[]).push({method,path:ref.path});return original.call(this,ref,...args);};fn.se7AuditWrapped=true;batchProto[method]=fn;}
  const commit=batchProto.commit;if(commit&&!commit.se7AuditWrapped){const fn=async function(...args){const result=await commit.apply(this,args);for(const w of this.__se7AuditWrites||[])log(({set:'Gravou dados em lote',update:'Atualizou dados em lote',delete:'Excluiu dados em lote'})[w.method],w.path);return result;};fn.se7AuditWrapped=true;batchProto.commit=fn;}
  const transaction=db.runTransaction.bind(db);db.runTransaction=async(update,...args)=>{let writes=[];const result=await transaction(tx=>{writes=[];const proxy=new Proxy(tx,{get(target,key){if(['set','update','delete'].includes(key))return (ref,...values)=>{writes.push({method:key,path:ref.path});target[key](ref,...values);return proxy;};const value=target[key];return typeof value==='function'?value.bind(target):value;}});return update(proxy);},...args);for(const w of writes)log(({set:'Gravou dados em transação',update:'Atualizou dados em transação',delete:'Excluiu dados em transação'})[w.method],w.path);return result;};
  installed=true;
 };
})();

/* Apenas medição de layout; sem consultas ou gravações no Firebase. */
(()=>{const header=document.getElementById('fixed-top-container');if(!header)return;const update=()=>{const h=Math.ceil(header.getBoundingClientRect().height);if(h>0)document.documentElement.style.setProperty('--se7-eja-sticky-top',h+'px');};update();if(window.ResizeObserver)new ResizeObserver(update).observe(header);else window.addEventListener('resize',update,{passive:true});})();
