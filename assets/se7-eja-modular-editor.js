(function(){
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const button=(text,fn)=>{const e=node('button',text);e.type='button';e.className='px-3 py-2 rounded bg-blue-700 text-white text-xs font-semibold mr-2 my-2';e.onclick=fn;return e;};
window.se7AbrirAvaliacaoModular=function(courseId){
const course=courses.find(c=>c.id===courseId);if(!course||course.ejaMode!=='modular')return;
const dialog=node('dialog');dialog.className='eja-modal-prova';dialog.style.cssText='width:min(96vw,1000px);max-height:92vh;overflow:auto;padding:18px';
dialog.append(node('h3','Avaliações EJA Modular — '+course.name),button('Fechar',()=>dialog.close()));
const select=node('select');select.className='w-full p-2 rounded dark:bg-slate-800';select.add(new Option('Selecione a disciplina',''));
(course.subjects||[]).forEach(s=>select.add(new Option(s.name||s.nome||s.id,s.id)));
const body=node('div');dialog.append(select,body);
const call=(operation,extra={})=>SE7.api('eja-modular-exam',{courseId,subjectId:select.value,operation,...extra});
const error=e=>body.prepend(node('p','Atenção: '+e.message));
async function render(){
body.replaceChildren();if(!select.value)return;
try{
const exam=(await call('read')).exam;
if(!exam){
body.append(node('p','Importar copia as cinco questões da Prova Única, sem alterar a origem.'));
for(const [label,operation] of [['Importar avaliação existente','import'],['Cadastrar do zero','create']])body.append(button(label,async()=>{try{await call(operation);await render();}catch(e){error(e);}}));
return;
}
body.append(node('p',(exam.published?'Publicada':'Rascunho')+' — '+exam.questions.length+' de 10 questões'));
const preview=node('div');preview.className='space-y-3';body.append(preview);
const editToggle=button('Editar questões',()=>{preview.hidden=true;container.hidden=false;editToggle.hidden=true;viewToggle.hidden=false;});
const viewToggle=button('Visualizar como aluno',()=>{preview.hidden=false;container.hidden=true;editToggle.hidden=false;viewToggle.hidden=true;});
body.append(editToggle,viewToggle);
const container=node('div');container.id='container-questoes-admin-eja-modular';body.append(container);
const previewQuestion=(q,i)=>{
 const section=node('fieldset');section.className='p-4 rounded-xl border border-slate-700 bg-slate-800/60 space-y-3 my-3';
 section.append(node('strong','Questão '+(i+1)+' de 10'));
 const heading=node('div',q.enunciado||'Enunciado ainda não cadastrado');heading.style.cssText='white-space:pre-wrap;line-height:1.6;text-align:justify';section.append(heading);
 if(q.imagem){const img=node('img');img.src=q.imagem;img.alt='Imagem da questão';img.style.cssText='max-width:220px;max-height:180px;object-fit:contain;cursor:zoom-in';img.onclick=()=>{const zoom=node('dialog');zoom.style.cssText='padding:18px;max-width:95vw';const large=node('img');large.src=q.imagem;large.style.cssText='max-width:90vw;max-height:75vh;object-fit:contain';zoom.append(large,button('Fechar',()=>zoom.close()));zoom.onclose=()=>zoom.remove();document.body.append(zoom);zoom.showModal();};section.append(img);}
 (q.opcoes||['','','','','']).forEach((option,j)=>{const label=node('label');label.style.cssText='display:flex;gap:10px;padding:10px;border:1px solid #475569;border-radius:10px;margin:6px 0';const radio=node('input');radio.type='radio';radio.name='modular-preview-'+i;radio.value=String(j);const span=node('span',String.fromCharCode(65+j)+') '+(option||'Alternativa não preenchida'));label.append(radio,span);section.append(label);});
 return section;
};
preview.append(node('p','Prévia do aluno — simulação sem envio de respostas ou registro de notas.'));
for(let i=0;i<10;i++)preview.append(previewQuestion(exam.questions[i]||{},i));
if(exam.published){editToggle.hidden=true;viewToggle.hidden=true;}else{container.hidden=true;viewToggle.hidden=true;}

for(let i=0;i<10;i++){
const q=exam.questions[i]||{};
const card=node('section');card.className='questao-card bg-white dark:bg-slate-800 p-4 rounded-xl border my-3 space-y-2';
card.append(node('strong','Questão '+(i+1)));
const label=node('label','Enunciado da Pergunta');const statement=node('textarea');statement.className='q-enunciado w-full p-2 rounded border dark:bg-slate-900';statement.rows=5;statement.value=q.enunciado||'';card.append(label,statement);
for(let j=0;j<5;j++){const wrap=node('label','Opção '+String.fromCharCode(65+j));wrap.className='block text-xs';const input=node('input');input.className='q-opt-'+j+' w-full p-2 border rounded dark:bg-slate-900';input.value=q.opcoes?.[j]||'';wrap.append(input);card.append(wrap);}
const answer=node('select');answer.className='q-correta p-2 border rounded dark:bg-slate-900';for(let j=0;j<5;j++)answer.add(new Option('Resposta correta: '+String.fromCharCode(65+j),j));answer.value=String(q.correta??0);card.append(answer);
const imageHost=node('div');ejaImagemControle(imageHost,q.imagem||'',!exam.published);card.append(imageHost);
if(exam.published)card.querySelectorAll('textarea,input,select').forEach(e=>e.disabled=true);
container.append(card);
}
const read=()=>[...container.children].map(card=>({enunciado:card.querySelector('.q-enunciado').value.trim(),opcoes:Array.from({length:5},(_,j)=>card.querySelector('.q-opt-'+j).value.trim()),correta:Number(card.querySelector('.q-correta').value),imagem:card.querySelector('.eja-img-control').dataset.image||''}));
if(!exam.published){
body.append(button('Salvar rascunho',async()=>{try{const questions=read();await call('save',{questions});await render();}catch(e){error(e);}}));
body.append(button('Publicar 10 questões',async()=>{try{if(!confirm('Publicar e bloquear edição?'))return;await call('save',{questions:read()});await call('publish');await render();}catch(e){error(e);}}));
}
}catch(e){error(e);}
}
select.onchange=render;dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
};
})();
