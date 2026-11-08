(function(){
const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
const btn=(text,fn)=>{const x=el('button',text);x.type='button';x.className='px-3 py-2 rounded bg-blue-700 text-white text-xs mr-2 my-2';x.onclick=fn;return x;};
const input=(value='',placeholder='')=>{const x=el('input');x.value=value;x.placeholder=placeholder;x.className='w-full p-2 border rounded dark:bg-slate-900 dark:text-white';return x;};
window.se7AbrirMateriaisModulares=function(courseId){
const course=courses.find(c=>c.id===courseId);if(!course||course.ejaMode!=='modular')return;
const dialog=el('dialog');dialog.className='eja-modal-prova';dialog.style.cssText='width:min(95vw,850px);max-height:90vh;overflow:auto;padding:20px';
dialog.append(el('h3','Conteúdo pedagógico — '+course.name),btn('Fechar',()=>dialog.close()));
const select=el('select');select.className='w-full p-2 border rounded dark:bg-slate-800';select.add(new Option('Selecione a disciplina',''));
(course.subjects||[]).forEach(s=>select.add(new Option(s.name||s.nome||s.id,s.id)));
const body=el('div');dialog.append(select,body);
const call=(operation,materials)=>SE7.api('eja-modular-materials',{courseId,subjectId:select.value,operation,materials});
select.onchange=async()=>{
body.replaceChildren();if(!select.value)return;
try{
const current=(await call('read')).materials||{},labels=['Primeira videoaula','Segunda videoaula','Terceira videoaula'];
const ementa=el('textarea');ementa.value=current.ementa||'';ementa.rows=5;ementa.className='w-full p-2 border rounded dark:bg-slate-900';
body.append(el('p','Ementa da disciplina'),ementa,el('p','Apostila PDF (link HTTPS)'));
const apostila=input(current.apostilaUrl||'','https://.../apostila.pdf');body.append(apostila);
const lessons=labels.map((label,i)=>{const wrap=el('div');wrap.className='p-3 my-3 border rounded';wrap.append(el('strong',label));const title=input(current.lessons?.[i]?.title||'','Título da aula');const url=input(current.lessons?.[i]?.url||'','Link HTTPS da videoaula');wrap.append(title,url);body.append(wrap);return {title,url};});
body.append(el('p','Os materiais são cadastrados como rascunho. A liberação ao aluno depende da integração do AVA e do pagamento confirmado.'));
body.append(btn('Salvar materiais',async()=>{try{const materials={ementa:ementa.value,apostilaUrl:apostila.value,lessons:lessons.map(x=>({title:x.title.value,url:x.url.value}))};const saved=await call('save',materials);alert(saved.materials.complete?'Conteúdo completo salvo.':'Rascunho salvo. Complete os campos para habilitar a futura publicação.');}catch(e){alert('Não foi possível salvar: '+e.message);}}));
}catch(e){body.append(el('p','Não foi possível carregar: '+e.message));}
};
dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
};
})();
