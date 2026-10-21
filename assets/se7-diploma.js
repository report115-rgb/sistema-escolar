/* Diploma SE7 — layout da prévia aprovada, logomarcas fixas, pendências recolhíveis.
 * Mantém a validação e emissão exclusivas do servidor (diploma-check/draft-save/authorize/print-record).
 */
(()=>{
 'use strict';
 // Logomarca fixa do diploma aprovado. NÃO consultar inst.logo, configuração da Instituição ou skin global.
 const LOGO='/assets/se7-diploma-approved-logo.png';
 const BRASAO='/assets/se7-diploma-para-emblem.png';
 // Composição do fundo conforme o padrão enviado (sem substituir as logomarcas).
 const relief=()=>`<div class="se7-relief" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 778" preserveAspectRatio="none"><path d="M59 -24 L98 -24 L411 801 L374 801 Z" fill="#edf4f7" opacity=".49"/><path d="M124 -24 L153 -24 L460 801 L429 801 Z" fill="#eaf3f8" opacity=".34"/><path d="M195 -24 L297 -24 L606 801 L509 801 Z" fill="#e6f0f6" opacity=".4"/><g fill="none" stroke="#bdd7e6" stroke-width=".75" opacity=".50"><path d="M970 -32 C1036 155 1007 506 1101 805"/><path d="M977 -32 C1043 155 1014 506 1108 805"/><path d="M984 -32 C1050 155 1021 506 1115 805"/><path d="M991 -32 C1057 155 1028 506 1122 805"/></g></svg></div>`;
 const h=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&quot;'}[c]));
 const fmt=v=>!v?'':/^\d{4}-\d{2}-\d{2}$/.test(String(v))?v.split('-').reverse().join('/'):String(v);
 const field=(v,placeholder='________________')=>v===null||v===undefined||String(v).trim()===''||String(v)==='undefined'?placeholder:esc(v);
 const css=`
 @page se7-diploma-landscape{size:A4 landscape;margin:0}
 @page se7-history{size:A4 portrait;margin:16mm}
 *{box-sizing:border-box}
 html,body{margin:0;padding:0;background:#fff;color:#164272;font-family:Arial,Helvetica,sans-serif}
  .se7-sheet{page:se7-diploma-landscape;width:297mm;height:210mm;position:relative;overflow:hidden;background:#fff;page-break-after:always;break-after:page;isolation:isolate}
 .se7-sheet:last-child{page-break-after:auto;break-after:auto}
 .se7-relief{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}
 .se7-relief svg{width:100%;height:100%;display:block}
 
 .se7-sheet>*:not(.se7-relief){z-index:1}
 .se7-head{position:absolute;top:10.7mm;left:15mm;right:15mm;height:31.5mm;display:grid;grid-template-columns:50mm 1fr 50mm;align-items:start;gap:1mm;border-bottom:1px solid #b1c9db;padding-bottom:6mm}
 .se7-head-logo{width:43mm;height:25mm;object-fit:contain;object-position:left top}
 .se7-head-crest{width:32mm;height:24mm;object-fit:contain;object-position:right top;justify-self:end}
 .se7-head-copy{text-align:center;line-height:1.2;min-width:0}
 .se7-head-copy .republic{font-size:10.7pt;font-weight:750;white-space:nowrap}
 .se7-head-copy .secretariat{font-size:9pt;margin-top:2mm}
 .se7-head-copy .school{font-size:11.5pt;font-weight:750;margin-top:2.8mm}
 .se7-head-copy .details{font-size:7.1pt;margin-top:2mm;color:#607488}
 .se7-head-copy .details+.details{margin-top:1mm}
 .se7-title{position:absolute;top:48.6mm;left:0;right:0;text-align:center;font-size:24pt;font-weight:750;letter-spacing:.1px;margin:0}
 .se7-title-line{position:absolute;top:61.4mm;width:110mm;left:calc(50% - 55mm);border-top:1px solid #3675a4}
 .se7-subtitle{position:absolute;top:64.2mm;left:0;right:0;text-align:center;font-size:10pt;font-weight:750}
 .se7-intro{position:absolute;top:71mm;left:23mm;right:23mm;text-align:center;font-size:9pt;line-height:1.48;margin:0}
 .se7-student-name{position:absolute;top:88mm;left:12mm;right:12mm;text-align:center;font-size:16pt;font-weight:750;margin:0}
 .se7-student-text{position:absolute;top:100mm;left:21mm;right:21mm;text-align:center;font-size:8.4pt;line-height:1.52;margin:0}
 .se7-hours{position:absolute;top:128mm;left:15mm;right:15mm;text-align:center;font-size:8.5pt;font-weight:750}
 .se7-front-copy{position:absolute;top:66mm;left:22mm;right:22mm;text-align:justify;font-size:10.5pt;line-height:1.6}.se7-front-copy p{margin:0;text-indent:7mm}.se7-front-copy p+p{margin-top:1.5em}.se7-inline-name{font-size:14pt;font-weight:800}.se7-front .se7-date{position:absolute;top:140mm;left:20mm;right:20mm;text-align:center;font-size:9pt;font-weight:750}
 .se7-signatures{position:absolute;left:19.4mm;right:19.4mm;bottom:26mm;display:flex;justify-content:space-between;gap:20mm}
 .se7-sign{width:42%;height:23.5mm;border:1px solid #a9bfd2;border-radius:3px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;text-align:center;padding:2mm 2mm 3mm;font-size:10pt;font-weight:750}
 .se7-sign small{font-size:6.8pt;color:#65798b;font-weight:400;margin-top:1.5mm}
 .se7-footer-note{position:absolute;bottom:17.7mm;left:0;right:0;text-align:center;font-size:7pt;color:#607488}
 .se7-watermark{position:absolute;bottom:10mm;left:15.8mm;color:#607488;font-size:7.5pt}
 .se7-reg-grid{position:absolute;top:74.5mm;left:21mm;right:27mm;display:grid;grid-template-columns:60.9% 36.4%;gap:2.7%}
 .se7-reg-card{height:69mm;padding:5mm;border:1px solid #abc0d4;border-radius:3px}
 .se7-reg-row{display:grid;grid-template-columns:43% 57%;gap:1mm;align-items:start;margin-bottom:4.5mm;font-size:9pt}
 .se7-reg-row span{overflow-wrap:anywhere}
 .se7-reg-heading{text-align:center;font-weight:750;font-size:9pt;margin:0 0 8mm}
 .se7-reg-sign{height:24mm;border:1px solid #aac2d6;border-radius:3px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:2.4mm;font-size:9.5pt;font-weight:750}
 .se7-reg-sign small{font-size:7pt;color:#637689;font-weight:400;margin-top:1mm}
 .se7-reg-bottom{position:absolute;bottom:26mm;left:21mm;width:31%;height:32mm}
 .se7-reg-bottom .se7-reg-sign{height:100%}
 .se7-qr{position:absolute;bottom:20mm;right:20mm;width:37mm;text-align:center;font-size:8pt}
 .se7-qr img,.se7-qr canvas{display:block;width:28mm;height:28mm;object-fit:contain;margin:auto}
 .se7-qr-placeholder{width:28mm;height:28mm;border:1px dashed #b4c9d7;display:flex;align-items:center;justify-content:center;margin:auto auto 2mm;font-size:7pt}
 .se7-back .se7-footer-note{bottom:17mm;left:90mm;right:19mm;text-align:right}
  .se7-history-frame{page:se7-history;box-sizing:border-box;width:210mm;max-width:210mm;min-height:297mm;padding:16mm;height:auto;overflow:visible;position:relative;break-before:page;page-break-before:always;page-break-after:auto;break-after:auto;background:#fff;color:#1e293b;font:11px/1.5 Arial,Helvetica,sans-serif;overflow-wrap:break-word}
 .se7-history-frame .academic-page{page:se7-history;box-sizing:border-box;width:100%;max-width:100%;min-height:0;padding:0;position:relative;background:#fff;break-before:auto;break-after:page;page-break-after:always;overflow:visible}
 .se7-history-frame .academic-page:last-of-type{break-after:auto;page-break-after:auto}
 .se7-history-frame header[data-se7-document-header],.se7-history-frame .se7-document-header{margin-top:-3mm!important;margin-bottom:5mm!important;line-height:1.18!important}
 .se7-history-frame header[data-se7-document-header] p,.se7-history-frame .se7-document-header p{margin-top:1mm!important;margin-bottom:1mm!important;line-height:1.2!important}
 .se7-history-frame h1{color:#1e3a8a;text-align:center;font-size:18px;line-height:1.3;margin:16px 0 18px}
 .se7-history-frame h2{color:#1e3a8a;font-size:14px;margin:15px 0 10px}
 .se7-history-frame .academic-student{background:#f1f5f9;border-radius:10px;padding:12px 15px;margin-bottom:18px;font-size:11px;line-height:1.7;break-inside:avoid}
 .se7-history-frame .academic-grid{width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px;line-height:1.35;margin-top:14px}
 .se7-history-frame .academic-grid th{background:#edf5fa;color:#123f75;text-align:left}
 .se7-history-frame .academic-grid td,.se7-history-frame .academic-grid th{padding:4px 5px;border:1px solid #cbd5e1;overflow-wrap:anywhere;word-break:normal}
 .se7-history-frame .academic-grid th:first-child{width:43%}
 .se7-history-frame .academic-grid thead{display:table-header-group}
 .se7-history-frame .academic-grid tr{break-inside:avoid}
 .se7-history-frame .academic-note{font-size:10px;color:#475569;margin-top:12px}
 .se7-history-frame .academic-syllabus{display:block;width:100%;max-width:none;margin-bottom:24px}
 .se7-history-frame .academic-syllabus h2{break-after:avoid}
 .se7-history-frame .academic-syllabus p{white-space:normal;overflow-wrap:anywhere}
 .se7-history-frame .academic-syllabus .se7-syllabus-text{display:block;width:100%;text-align:justify;white-space:normal;line-height:1.6;hyphens:auto}
 .se7-history-frame .academic-signatures{break-inside:avoid;margin-top:35px}
 .se7-history-frame .se7-document-relief{position:absolute;inset:0;pointer-events:none;z-index:0}
 .se7-history-frame .se7-document-relief svg{width:100%;height:100%}
 .se7-history-frame .academic-page>*{position:relative;z-index:1}
 .se7-history-frame .academic-page>.se7-document-relief{position:absolute;z-index:0}
  .se7-history-frame .se7-watermark{position:relative;left:auto;bottom:auto;margin:4mm}
 @media screen{html,body{background:#e1e9ef;padding:12px}.se7-sheet,.se7-history-frame{margin:0 auto 18px;box-shadow:0 3px 13px #1e41602d}}
 @media print{html,body{padding:0!important;background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.se7-sheet,.se7-history-frame{margin:0!important;box-shadow:none!important}.se7-history-frame{width:auto!important;max-width:none!important;min-height:0!important;padding:0!important}.se7-history-frame .academic-page{width:100%!important;min-height:0!important;padding:0!important}.se7-history-frame table{max-width:100%!important}}
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
  // QR da prévia contém apenas uma identificação demonstrativa, nunca uma credencial de emissão.
  const url=token?location.origin+'/assets/validar-documento.html#'+encodeURIComponent(token):'SE7 - DIPLOMA EM CONFERENCIA - SEM VALIDADE';
  if(typeof window.QRCode==='undefined')return '<div class="se7-qr-placeholder">'+(token?'Verificação indisponível':'QR demonstrativo')+'</div>';
  const target=h('div');new window.QRCode(target,{text:url,width:150,height:150,correctLevel:window.QRCode.CorrectLevel.M});
  const canvas=target.querySelector('canvas'),img=target.querySelector('img');return canvas?'<img alt="QR para verificação" src="'+canvas.toDataURL('image/png')+'">':img?'<img alt="QR para verificação" src="'+esc(img.src)+'">':'';
 }
 function renderDoc(student,course,inst,reg,token,preview,history){
  const head=schoolHeader(inst),name=esc(student.fullname||student.nome||'—');
  const birth=student.birthDate||student.dob||student.dataNascimento||student.nascimento||'—';
  const origin=student.birthplace||student.naturalidade||student.city||student.cidade||'—';
  const courseName=esc(course.name||'—');
  const completion=reg?.verifiedCompletionDate||student.conclusionDate||student.completionDate||student.dataConclusao||student.finishedAt||'';
  const nationality=esc(student.nacionalidade||student.nationality||'—');
  const rg=esc(student.rg||student.RG||'—');
  const cpf=esc(student.cpf||'—');
  const theoryHours=Number(course.theoryHours);
  const internshipHours=Number(course.internshipHours);
  const hoursReady=course.theoryHours!==null&&course.theoryHours!==undefined&&course.theoryHours!==''&&course.internshipHours!==null&&course.internshipHours!==undefined&&course.internshipHours!==''&&Number.isFinite(theoryHours)&&Number.isFinite(internshipHours)&&theoryHours>=0&&internshipHours>=0;
  const hoursText=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n);
    const mark=preview?'<div class="se7-watermark">DEMONSTRAÇÃO — PRÉVIA PARA CONFERÊNCIA — SEM VALIDADE</div>':'';
  const front=`<section class="se7-sheet se7-front">${relief()}${head}<h1 class="se7-title">DIPLOMA</h1><div class="se7-front-copy"><p>O Diretor da <strong>${esc(inst?.name||inst?.razao||'—')}</strong>, no uso de suas atribuições legais e regimentais, confere o título de <strong>TÉCNICO(A) DE ENFERMAGEM</strong> a <strong class="se7-inline-name">${name}</strong>, de nacionalidade ${nationality}, natural de ${esc(origin)}, nascido(a) em ${esc(fmt(birth))}, portador(a) da Cédula de Identidade RG nº ${rg} e inscrito(a) no CPF sob o nº ${cpf}, por ter concluído com aproveitamento, em <strong>${esc(fmt(completion)||'—')}</strong>, o curso de <strong>Habilitação Profissional Técnica de Nível Médio em Enfermagem</strong>, com carga horária total de <strong>${hoursReady?hoursText(theoryHours):'—'} horas</strong> de disciplinas teóricas/práticas e <strong>${hoursReady?hoursText(internshipHours):'—'} horas</strong> de estágio supervisionado obrigatório, totalizando <strong>${hoursReady?hoursText(theoryHours+internshipHours):"—"} horas</strong> de curso.</p><p>Para constar, expede-se o presente <strong>DIPLOMA</strong> para que produza todos os efeitos legais, nos termos da Lei de Diretrizes e Bases da Educação Nacional (Lei nº 9.394/1996), do Decreto Federal nº 5.154/2004 e do Catálogo Nacional de Cursos Técnicos (CNCT).</p></div><div class="se7-date">Vigia / PA, ${esc(fmt(reg?.issueDate||new Date().toISOString().slice(0,10)))}</div><div class="se7-signatures"><div class="se7-sign">Direção da instituição<small>Assinatura digital / conferência</small></div><div class="se7-sign">Concluinte<small>Assinatura / identificação</small></div></div><div class="se7-footer-note">Logomarca SE7 à esquerda • Brasão do Pará à direita • Assinaturas oficiais após autorização</div>${mark}</section>`;
  const back=`<section class="se7-sheet se7-back">${relief()}${head}<h1 class="se7-title">REGISTRO DO DIPLOMA</h1><div class="se7-title-line"></div><div class="se7-subtitle">SETOR DE REGISTRO DE DIPLOMAS E CERTIFICADOS</div><div class="se7-reg-grid"><div class="se7-reg-card" style="font-size:10pt;line-height:1.8"><div style="font-weight:750;text-align:center;margin-bottom:5mm">${esc(inst?.name||inst?.razao||'—')}</div><p><strong>Diplomado:</strong> ${name}</p><p><strong>Curso:</strong> ${courseName}</p><p>Registrado sob o nº <strong>${field(reg?.recordNumber)}</strong>, no Livro nº <strong>${field(reg?.book)}</strong>, Folha nº <strong>${field(reg?.sheet)}</strong>, em <strong>${field(fmt(reg?.registrationDate))}</strong>.</p><p><strong>Código de Autenticação SISTEC/MEC:</strong> ${field(reg?.sistec)}</p><p><strong>Ato / Processo Autorizativo CEE/PA:</strong> ${field(reg?.ceeAct)}</p></div><div class="se7-reg-card"><h2 class="se7-reg-heading">RESPONSÁVEIS PELO REGISTRO</h2><div class="se7-reg-sign">Secretaria Acadêmica<small>Assinatura digital / identificação</small></div></div></div><div class="se7-reg-bottom"><div class="se7-reg-sign">Direção / Responsável autorizado<small>Assinatura digital / identificação</small></div></div><div class="se7-qr">${qrHTML(token)}<div>${preview?'QR DEMONSTRATIVO':'VALIDAÇÃO DIGITAL'}</div></div><div class="se7-footer-note">Dados oficiais de registro e SISTEC sujeitos à conferência institucional.</div>${mark}</section>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Diploma SE7</title><style>${css}</style></head><body>${front}${back}${historySection(history,preview)}</body></html>`;
 }
 function dialog(){let d=document.getElementById('se7-diploma-dialog');if(d)return d;d=h('dialog');d.id='se7-diploma-dialog';d.style.cssText='width:min(1000px,97vw);max-height:94vh;border:1px solid #bacfe0;border-radius:14px;padding:20px;background:#fff;color:#164272;overflow:auto;box-shadow:0 12px 45px #12375a55';document.body.append(d);return d;}
 if(!document.getElementById('se7-diploma-ui-style')){const st=h('style');st.id='se7-diploma-ui-style';st.textContent=`#se7-diploma-dialog label{display:block;font-size:13px;font-weight:650;margin:11px 0 5px}#se7-diploma-dialog input{width:100%;border:1px solid #b7c9da;padding:10px;border-radius:7px;outline-offset:2px;background:#fff!important;color:#152c44!important;caret-color:#152c44!important;color-scheme:light}#se7-diploma-dialog input::placeholder{color:#60748b!important}#se7-diploma-dialog button{border:1px solid #164d85;border-radius:7px;padding:9px 13px;cursor:pointer;background:white;color:#164272}#se7-diploma-dialog button.primary{background:#164d85;color:white}#se7-diploma-dialog button:disabled{opacity:.45;cursor:not-allowed}#se7-diploma-dialog details{border:1px solid #d7e2eb;border-radius:8px;margin:12px 0;padding:9px 12px}#se7-diploma-dialog summary{cursor:pointer;font-weight:650}#se7-diploma-dialog iframe{width:100%;height:min(52vh,520px);border:1px solid #b9cbd8;margin-top:9px;background:white}#se7-diploma-dialog .diploma-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px}#se7-diploma-dialog .diploma-fields>div:last-child{grid-column:1/-1}#se7-diploma-dialog .diploma-actions{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0}`;document.head.append(st);}
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
  const values={...(checked.draft||{})};const repaint=()=>{preview.srcdoc=renderDoc(student,course,inst||{},{...values,verifiedCompletionDate:checked.completionDate||''},'',true,historic)};repaint();
  if(mode==='view')return;
  edit.append(h('h3','Escrituração do verso do diploma'));
  edit.append(h('p','Preencha os dados, salve e depois solicite a emissão. A senha da conta Master é obrigatória para autorizar a impressão.'));
  const inputs=h('div');inputs.className='diploma-fields';edit.append(inputs);
  const fields=[['book','Registrado no livro','text'],['sheet','Folha nº','text'],['recordNumber','Registro nº','text'],['sistec','Código de Autenticação SISTEC/MEC','text'],['registrationDate','Data de registro','date'],['ceeAct','Ato / Processo Autorizativo CEE/PA (instituição)','text']];
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
    const html=renderDoc(student,course,inst||{},{...r.registration,verifiedCompletionDate:r.completionDate||''},r.token,false,historic);
    w.document.open();w.document.write(html);w.document.close();w.focus();
    await Promise.all([...w.document.images].map(im=>im.complete?Promise.resolve():new Promise(ok=>{im.onload=im.onerror=ok;setTimeout(ok,7000)})));
    if(!w.closed)w.print();state.textContent='Emissão registrada. Confira a janela de impressão.';
   }catch(e){if(!w.closed)w.close();auth.disabled=false;state.textContent='Emissão não concluída: '+e.message;}
  };
 }
 window.SE7Diploma={open};
})();
