/* Ajustes visuais do Matriz. Não realiza gravações no Firebase. */
const se7ModulosMatriz={
 'tab-gestion-students':['Gestão de Alunos','Organize cadastros e acompanhe a documentação acadêmica.'],
 'tab-gestao-eja':['Gestão EJA','Gerencie apostilas, provas e documentação dos alunos EJA.'],
 'tab-students':['Matrícula','Cadastre alunos e acompanhe solicitações de matrícula.'],
 'tab-attendance':['Frequência','Consulte e registre a frequência dos alunos.'],
 'tab-grades':['Notas','Organize avaliações e acompanhe o desempenho acadêmico.'],
 'tab-student-finance':['Financeiro','Acompanhe cobranças e informações financeiras dos alunos.'],
 'tab-history':['Emissão de Documentos','Emita declarações, contratos e históricos acadêmicos.'],
 'tab-controle-ponto-manual':['Ponto Manual','Registre e consulte os horários dos colaboradores.'],
 'tab-settings':['Sistema','Gerencie cursos, turmas e configurações da instituição.']
};
function atualizarModuloMatriz(id){const [title,description]=se7ModulosMatriz[id]||['Sistema Matriz','Tudo conectado ao sistema Matriz'];document.getElementById('se7-page-title').textContent=title;document.getElementById('se7-page-description').textContent=description;atualizarCabecalhoMatriz(id);}
function atualizarCabecalhoMatriz(id){let user={};try{user=JSON.parse(sessionStorage.getItem('usuario_logado')||'{}');}catch{}const role=document.getElementById('se7-header-role');if(role)role.textContent=({master:'Master',secretaria:'Secretaria',professor:'Professor',financeiro:'Financeiro'}[user.perfil]||'Usuário');const button=document.getElementById('se7-new-enrollment');if(button){const active=id||document.querySelector('#main-tabs-nav .active')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];button.style.display=active==='tab-gestion-students'&&['master','secretaria'].includes(user.perfil)?'inline-flex':'none';}}
function alternarMenuMatriz(){const collapsed=document.body.classList.toggle('se7-sidebar-collapsed');const button=document.getElementById('se7-sidebar-toggle');button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'Expandir menu lateral':'Recolher menu lateral');try{localStorage.setItem('se7-matriz-sidebar',collapsed?'collapsed':'expanded');}catch{}window.dispatchEvent(new Event('resize'));}
window.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('#main-tabs-nav .tab-button').forEach(button=>{button.title=button.textContent.trim();button.setAttribute('aria-label',button.textContent.trim());if(button.classList.contains('active'))button.setAttribute('aria-current','page');});try{if(localStorage.getItem('se7-matriz-sidebar')==='collapsed')alternarMenuMatriz();}catch{}atualizarCabecalhoMatriz();});
