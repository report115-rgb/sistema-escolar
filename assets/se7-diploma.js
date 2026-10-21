/* Diploma SE7 — layout da prévia aprovada, logomarcas fixas, pendências recolhíveis.
 * Mantém a validação e emissão exclusivas do servidor (diploma-check/draft-save/authorize/print-record).
 */
(()=>{
 'use strict';
 // Logomarca fixa do diploma aprovado. NÃO consultar inst.logo, configuração da Instituição ou skin global.
 const LOGO='/assets/se7-diploma-approved-logo.png';
 const BRASAO='/assets/se7-diploma-para-emblem.png';
 const h=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&quot;'}[c]));
 const fmt=v=>!v?'':/^\d{4}-\d{2}-\d{2}$/.test(String(v))?v.split('-').reverse().join('/'):String(v);
 const field=(v,placeholder='________________')=>v===null||v===undefined||String(v).trim()===''||String(v)==='undefined'?placeholder:esc(v);
 const css=`
 @page {size:A4 landscape;margin:0}
 @page se7-history {size:A4 portrait;margin:0}
 *{box-sizing:border-box}html,body{margin:0;padding:0;color:#164272;font-family:Arial,'Helvetica Neue',sans-serif;background:#fff}
 .se7-sheet{position:relative;width:297mm;height:210mm;background:#fff;overflow:hidden;page-break-after:always;break-after:page;isolation:isolate}
 .se7-sheet:last-child{break-after:auto;page-break-after:auto}
 .se7-sheet .se7-relief{position:absolute;inset:0;pointer-events:none;z-index:0}
 .se7-sheet .se7-relief:before{content:'';position:absolute;top:-23%;left:22%;height:145%;width:14%;transform:rotate(-20deg);background:linear-gradient(90deg,transparent,#dfebf149 30%,#dfebf161 50%,#e2ecf340 80%,transparent)}
 .se7-sheet .se7-relief:after{content:'';position:absolute;top:0;bottom:0;right:5%;width:12%;background:repeating-linear-gradient(83deg,transparent 0px,transparent 12px,#e1edf466 13px,#e1edf466 14px,transparent 15px,transparent 21px);clip-path:polygon(80% 0,100% 0,100% 100%,94% 100%)}
 .se7-sheet>*:not(.se7-relief){position:relative;z-index:1}
 .se7-head{height:43mm;margin:0 15mm;border-bottom:1px solid #1a4d86;display:grid;grid-template-columns:32mm minmax(0,1fr) 32mm;gap:5mm;align-items:center}
 .se7-head-logo{display:block;width:29.5mm;height:17.3mm;object-fit:contain;justify-self:center}
 .se7-head-crest{display:block;width:17.1mm;height:21.4mm;object-fit:contain;justify-self:center}
 .se7-head-copy{text-align:center;line-height:1.28;min-width:0}
 .se7-head-copy .republic{font-size:12.1pt;letter-spacing:.18px;font-weight:750}
 .se7-head-copy .secretariat{font-size:10.3pt;margin-top:3.1mm}
 .se7-head-copy .school{font-size:13.1pt;font-weight:750;margin-top:3mm;overflow-wrap:anywhere}
 .se7-head-copy .details{font-size:8pt;margin-top:2mm;color:#65758a}
 .se7-title{text-align:center;margin:7mm 0 0;font-size:26pt;font-weight:760;letter-spacing:.45px}
 .se7-title-line{width:110mm;margin:3mm auto 1mm;border-top:1px solid #3675a4}
 .se7-subtitle{text-align:center;font-size:11.5pt;font-weight:750}
 .se7-intro{text-align:center;font-size:11pt;line-height:1.65;margin:5mm auto 0;width:88%}
 .se7-student-name{text-align:center;font-size:22pt;font-weight:760;margin:7mm 12mm 3mm;letter-spacing:.2px}
 .se7-student-text{text-align:center;font-size:10.8pt;line-height:1.8;width:87%;margin:0 auto}
 .se7-hours{text-align:center;font-size:11pt;font-weight:750;margin-top:10mm}
 .se7-date{text-align:right;font-size:10.4pt;font-weight:750;margin:9mm 19mm 0}
 .se7-signatures{position:absolute!important;bottom:23mm;left:21mm;right:21mm;display:flex;justify-content:space-between;align-items:flex-end;gap:12mm}
 .se7-sign{width:42%;height:27.5mm;border:1px solid #aec5d7;border-radius:3px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;text-align:center;padding:3mm 3mm 2.2mm;font-size:12pt;font-weight:750}
 .se7-sign small{font-size:7.2pt;font-weight:400;color:#617386;margin-top:1.5mm}
 .se7-footer-note{position:absolute!important;left:19mm;bottom:17mm;right:19mm;text-align:center;color:#6b7b89;font-size:7pt}
 .se7-watermark{position:absolute!important;bottom:9mm;left:16mm;color:#687c8d;font-size:8pt}
 .se7-back .se7-title{margin-top:7.4mm}
 .se7-back .se7-subtitle{margin-top:3mm}
 .se7-reg-grid{display:grid;grid-template-columns:60% 36%;gap:3%;margin:8mm 19mm 0}
 .se7-reg-card{border:1px solid #b1c7da;border-radius:3.5px;min-height:67mm;padding:6.4mm 5mm}
 .se7-reg-row{display:grid;grid-template-columns:48% 52%;gap:2mm;margin-bottom:4.1mm;align-items:start;font-size:10.1pt}
 .se7-reg-row b{font-weight:760}.se7-reg-row span{overflow-wrap:anywhere}
 .se7-reg-heading{text-align:center;font-size:10.8pt;font-weight:750;margin:0 0 6mm}
 .se7-reg-sign{border:1px solid #aec5d7;border-radius:3px;min-height:24mm;padding:4mm 3mm 2mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;font-size:11.5pt;font-weight:760;text-align:center}
 .se7-reg-sign small{font-size:7pt;color:#64778a;font-weight:400;margin-top:1.5mm}
 .se7-back .se7-reg-bottom{position:absolute!important;left:21mm;bottom:21mm;width:42%;height:31mm}
 .se7-back .se7-reg-bottom .se7-reg-sign{height:100%;min-height:0}
 .se7-qr{position:absolute!important;right:19mm;bottom:20mm;width:37mm;text-align:center;color:#164272;font-size:8pt;font-weight:700}
 .se7-qr img,.se7-qr canvas{width:32mm;height:32mm;object-fit:contain;display:block;margin:auto}
 .se7-qr-placeholder{width:32mm;height:32mm;border:1px dashed #b4c9d7;display:flex;align-items:center;justify-content:center;font-size:8pt;margin:auto auto 2mm}
 .se7-back .se7-watermark{bottom:9mm}
 .se7-history-frame{page:se7-history;width:210mm;min-height:297mm;height:auto;overflow:visible;position:relative;break-after:auto;page-break-after:auto}
 .se7-history-frame .se7-watermark{position:relative!important;left:auto;bottom:auto;margin:4mm;color:#687c8d}
 @media screen{html,body{background:#e1e9ef;padding:12px}.se7-sheet{margin:0 auto 18px;box-shadow:0 3px 13px #1e41602d}.se7-history-frame{background:white;margin:auto;box-shadow:0 3px 13px #1e41602d}}
 @media print{html,body{padding:0!important;background:white!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.se7-sheet,.se7-history-frame{margin:0!important;box-shadow:none!important}}
 `;
 function schoolHeader(inst){
  const name=inst?.razao||inst?.name||'INSTITUIÇÃO DE ENSINO';
  const address=inst?.endereco||inst?.end||'';
  const city=inst?.cidade||inst?.city||'';
  return `<header class="se7-head"><img class="se7-head-logo" src="${LOGO}" alt="Marca SE7 aprovada"><div class="se7-head-copy"><div class="republic">REPÚBLICA FEDERATIVA DO BRASIL - ESTADO DO PARÁ</div><div class="secretariat">SECRETARIA DE ESTADO DE EDUCAÇÃO</div><div class="school">${esc(name)}</div><div class="details">CNPJ: ${esc(inst?.cnpj||'—')} • ${esc(address)} ${esc(city)}</div><div class="details">Ato autorizativo: ${esc(inst?.atoAutorizativo||'A conferir antes da emissão')}</div></div><img class="se7-head-crest" src="${BRASAO}" alt="Brasão do Estado do Pará"></header>`;
 }
 function historySection(raw,preview){
  const parsed=new DOMParser().parseFromString(raw,'text/html');
  parsed.querySelectorAll('script').forEach(n=>n.remove());
  const content=parsed.body?.innerHTML||'';
  return `<section class="se7-history-frame">${content}${preview?'<div class="se7-watermark">PRÉVIA PARA CONFERÊNCIA — SEM VALIDADE</div>':''}</section>`;
 }
 function qrHTML(token){
  if(!token)return '<div class="se7-qr-placeholder">QR disponível após autorização</div>';
  const url=location.origin+'/assets/validar-documento.html#'+encodeURIComponent(token);
  if(typeof window.QRCode==='undefined')return '<div class="se7-qr-placeholder">Verificação: '+esc(token.slice(0,12))+'</div>';
  const target=h('div');new window.QRCode(target,{text:url,width:150,height:150,correctLevel:window.QRCode.CorrectLevel.M});
  const canvas=target.querySelector('canvas'),img=target.querySelector('img');return canvas?'<img alt="QR para verificação" src="'+canvas.toDataURL('image/png')+'">':img?'<img alt="QR para verificação" src="'+esc(img.src)+'">':'';
 }
 function renderDoc(student,course,inst,reg,token,preview,history){
  const head=schoolHeader(inst),name=esc(student.fullname||student.nome||'—');
  const birth=student.birthDate||student.dob||student.dataNascimento||student.nascimento||'—';
  const origin=student.birthplace||student.naturalidade||student.city||student.cidade||'—';
  const courseName=esc(course.name||'Técnico em Enfermagem');
  const hours=esc(course.hours||course.cargaHoraria||'—');
  const mark=preview?'<div class="se7-watermark">PRÉVIA PARA CONFERÊNCIA — SEM VALIDADE</div>':'';
  const front=`<section class="se7-sheet se7-front"><div class="se7-relief"></div>${head}<h1 class="se7-title">DIPLOMA</h1><div class="se7-title-line"></div><div class="se7-subtitle">HABILITAÇÃO PROFISSIONAL TÉCNICA DE NÍVEL MÉDIO</div><p class="se7-intro">A instituição, no exercício de suas atribuições e de acordo com as normas aplicáveis,<br>confere o presente Diploma de Técnico em Enfermagem a</p><div class="se7-student-name">${name}</div><p class="se7-student-text">Nascido(a) em ${esc(fmt(birth))}, em ${esc(origin)}, por ter concluído integralmente o Curso ${courseName},<br>do Eixo Tecnológico Ambiente e Saúde, conforme matriz curricular e requisitos acadêmicos da instituição.</p><div class="se7-hours">Carga horária: ${hours} h</div><div class="se7-date">Vigia / PA, ${esc(fmt(reg?.issueDate||new Date().toISOString().slice(0,10)))}</div><div class="se7-signatures"><div class="se7-sign">Direção da instituição<small>Assinatura digital / conferência</small></div><div class="se7-sign">Concluinte<small>Assinatura / identificação</small></div></div><div class="se7-footer-note">Logomarca SE7 à esquerda • Símbolo do Pará à direita • Assinaturas oficiais após autorização</div>${mark}</section>`;
  const back=`<section class="se7-sheet se7-back"><div class="se7-relief"></div>${head}<h1 class="se7-title">REGISTRO DO DIPLOMA</h1><div class="se7-title-line"></div><div class="se7-subtitle">ESCRITURAÇÃO INSTITUCIONAL</div><div class="se7-reg-grid"><div class="se7-reg-card"><div class="se7-reg-row"><b>Registrado no livro:</b><span>${field(reg?.book)}</span></div><div class="se7-reg-row"><b>Folha nº:</b><span>${field(reg?.sheet)}</span></div><div class="se7-reg-row"><b>Número SISTEC:</b><span>${field(reg?.sistec)}</span></div><div class="se7-reg-row"><b>Data de registro:</b><span>${field(fmt(reg?.registrationDate))}</span></div><div class="se7-reg-row"><b>Data de expedição:</b><span>${field(fmt(reg?.issueDate))}</span></div><div class="se7-reg-row"><b>Ato / Processo Autorizativo CEE/PA:</b><span>${field(reg?.ceeAct)}</span></div></div><div class="se7-reg-card"><h2 class="se7-reg-heading">RESPONSÁVEIS PELO REGISTRO</h2><div class="se7-reg-sign">Secretaria Acadêmica<small>Assinatura digital / identificação</small></div></div></div><div class="se7-reg-bottom"><div class="se7-reg-sign">Direção / Responsável autorizado<small>Assinatura digital / identificação</small></div></div><div class="se7-qr">${qrHTML(token)}<div>${preview?'QR DEMONSTRATIVO':'VALIDAÇÃO DIGITAL'}</div></div>${mark}</section>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Diploma SE7</title><style>${css}</style></head><body>${front}${back}${historySection(history,preview)}</body></html>`;
 }
 function dialog(){let d=document.getElementById('se7-diploma-dialog');if(d)return d;d=h('dialog');d.id='se7-diploma-dialog';d.style.cssText='width:min(1000px,97vw);max-height:94vh;border:1px solid #bacfe0;border-radius:14px;padding:20px;background:#fff;color:#164272;overflow:auto;box-shadow:0 12px 45px #12375a55';document.body.append(d);return d;}
 if(!document.getElementById('se7-diploma-ui-style')){const st=h('style');st.id='se7-diploma-ui-style';st.textContent=`#se7-diploma-dialog label{display:block;font-size:13px;font-weight:650;margin:11px 0 5px}#se7-diploma-dialog input{width:100%;border:1px solid #b7c9da;padding:10px;border-radius:7px;outline-offset:2px}#se7-diploma-dialog button{border:1px solid #164d85;border-radius:7px;padding:9px 13px;cursor:pointer;background:white;color:#164272}#se7-diploma-dialog button.primary{background:#164d85;color:white}#se7-diploma-dialog button:disabled{opacity:.45;cursor:not-allowed}#se7-diploma-dialog details{border:1px solid #d7e2eb;border-radius:8px;margin:12px 0;padding:9px 12px}#se7-diploma-dialog summary{cursor:pointer;font-weight:650}#se7-diploma-dialog iframe{width:100%;height:min(52vh,520px);border:1px solid #b9cbd8;margin-top:9px;background:white}#se7-diploma-dialog .diploma-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px}#se7-diploma-dialog .diploma-fields>div:last-child{grid-column:1/-1}#se7-diploma-dialog .diploma-actions{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0}`;document.head.append(st);}
 async function open(mode,student,course,group,inst){
  const d=dialog();d.replaceChildren();
  const bar=h('div');bar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:10px';bar.append(h('h2','Diploma de Técnico em Enfermagem — '+(student.fullname||'')));
  const close=h('button','Fechar');close.onclick=()=>d.close();bar.append(close);d.append(bar);
  const state=h('p','Conferindo requisitos de emissão...');state.setAttribute('role','status');d.append(state);
  const preview=h('iframe');preview.title='Prévia do diploma e histórico escolar';d.append(preview);
  const pending=h('details');pending.hidden=true;
  const summary=h('summary');pending.append(summary);const pendList=h('ul');pending.append(pendList);d.append(pending);
  const edit=h('section');d.append(edit);d.showModal();
  let checked;try{checked=await window.SE7.api('diploma-check',{studentId:student.id});}catch(e){state.textContent='Não foi possível conferir o diploma: '+e.message;return;}
  const issues=Array.isArray(checked.result?.issues)?checked.result.issues:[];
  state.textContent=issues.length?'Emissão bloqueada — '+issues.length+' pendência(s). Consulte em “Pendências”.':'Conferência acadêmica concluída: sem pendências identificadas.';
  if(issues.length){summary.textContent='Pendências ('+issues.length+') ▾';for(const msg of issues)pendList.append(h('li',msg));pending.hidden=false;}
  let historic='';try{historic=await window.SE7Templates.diplomaHistory(student,course,group);if(!historic||!String(historic).trim())throw Error('Histórico vazio');}catch(e){state.textContent='Não foi possível carregar o Histórico Escolar Completo: '+e.message;return;}
  const values={...(checked.draft||{})};const repaint=()=>{preview.srcdoc=renderDoc(student,course,inst||{},values,'',true,historic)};repaint();
  if(mode==='view')return;
  edit.append(h('h3','Escrituração do verso do diploma'));
  edit.append(h('p','Preencha os dados, salve e depois solicite a emissão. A senha da conta Master é obrigatória para autorizar a impressão.'));
  const inputs=h('div');inputs.className='diploma-fields';edit.append(inputs);
  const fields=[['book','Registrado no livro','text'],['sheet','Folha nº','text'],['sistec','Número SISTEC','text'],['registrationDate','Data de registro','date'],['issueDate','Data de expedição','date'],['ceeAct','Ato / Processo Autorizativo CEE/PA','text']];
  const actions=h('div');actions.className='diploma-actions';const save=h('button','Salvar escrituração');save.className='primary';const auth=h('button','Emitir diploma — autorização Master');auth.disabled=true;actions.append(save,auth);
  let saved=false;
  const passArea=h('div');passArea.hidden=true;const passLabel=h('label','Senha atual do Master');const password=h('input');password.type='password';password.autocomplete='current-password';passArea.append(passLabel,password);
  const editors={};for(const [id,label,type] of fields){const wrap=h('div'),lbl=h('label',label),input=h('input');input.type=type;input.maxLength=220;input.value=values[id]||'';editors[id]=input;input.oninput=()=>{values[id]=input.value;saved=false;auth.disabled=true;passArea.hidden=true;repaint();};wrap.append(lbl,input);inputs.append(wrap);}
  edit.append(actions,passArea);
  save.onclick=async()=>{save.disabled=true;try{const r=await window.SE7.api('diploma-draft-save',{studentId:student.id,...values});if(!r.saved)throw Error('Salvamento não confirmado');saved=true;auth.disabled=issues.length>0;passArea.hidden=issues.length>0;state.textContent=issues.length?'Escrituração salva. A emissão segue bloqueada pelas pendências.':'Escrituração salva. Confirme a senha Master para emitir.';}catch(e){state.textContent='Erro ao salvar a escrituração: '+e.message;}finally{save.disabled=false;}};
  auth.onclick=async()=>{
   if(!saved){state.textContent='Salve a escrituração primeiro.';return;}
   if(!window.confirm('Autorizar a emissão oficial do diploma deste aluno?'))return;
   // Abre dentro do clique para não ser bloqueada por pop-up; sem liberar impressão antes da autorização.
   const w=window.open('','_blank','width=1150,height=860');if(!w){state.textContent='Permita a janela de impressão no navegador.';return;}
   w.opener=null;w.document.write('<p>Conferindo autorização do Master...</p>');auth.disabled=true;
   try{
    const r=await window.SE7.api('diploma-authorize',{studentId:student.id,...values,password:password.value});password.value='';
    if(!r.authorized)throw Error('Emissão não autorizada');
    const record=await window.SE7.api('diploma-print-record',{studentId:student.id,token:r.token});if(!record.ok)throw Error('O registro de emissão não foi confirmado');
    const html=renderDoc(student,course,inst||{},r.registration,r.token,false,historic);
    w.document.open();w.document.write(html);w.document.close();w.focus();
    await Promise.all([...w.document.images].map(im=>im.complete?Promise.resolve():new Promise(ok=>{im.onload=im.onerror=ok;setTimeout(ok,7000)})));
    if(!w.closed)w.print();state.textContent='Emissão registrada. Confira a janela de impressão.';
   }catch(e){if(!w.closed)w.close();auth.disabled=false;state.textContent='Emissão não concluída: '+e.message;}
  };
 }
 window.SE7Diploma={open};
})();
