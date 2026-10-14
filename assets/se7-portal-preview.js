/* O master consulta o próprio portal sem assumir a sessão do aluno. */
(()=>{
 const active=location.pathname.endsWith('app-aluno.html')&&new URLSearchParams(location.search).get('se7-preview')==='1';
 const notice='Modo de visualização: esta ação está desativada.';
 if(active){
  const channel=location.hash.slice(1),pending=new Map();let snapshot,loading;
  const request=(operation,data={})=>new Promise((resolve,reject)=>{if(parent===window)return reject(Error('Abra a visualização pela lista de alunos do Matriz.'));const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('Não foi possível carregar a visualização. Feche e abra novamente pelo Matriz.'));},20000);pending.set(id,{resolve,reject,timer});parent.postMessage({type:'se7-preview-request',channel,id,operation,data},location.origin);});
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='se7-preview-response'||e.data.channel!==channel)return;const p=pending.get(e.data.id);if(!p)return;clearTimeout(p.timer);pending.delete(e.data.id);if(e.data.error)p.reject(Error(e.data.error));else p.resolve(e.data.result);});
  async function refresh(){if(loading)return loading;loading=request('snapshot').then(r=>{snapshot=r;return r;}).finally(()=>loading=null);return loading;}
  async function data(){return snapshot||await refresh();}
  const profile=s=>({...s,portalBlocked:false,portalMustChangePassword:false});
  const snap=row=>({id:row?.id,exists:!!row,metadata:{hasPendingWrites:false,fromCache:false},data:()=>row?profile(row):undefined});
  function database(){return {collection(name){if(!['students','courses','classes','academicCalendars','financeLogs','config'].includes(name))throw Error(notice);const filters=[];const q={doc(id){return {get:async()=>snap((await data()).collections[name].find(r=>r.id===id))};},where(key,op,value){if(op!=='==')throw Error(notice);filters.push([key,value]);return q;},get:async()=>{const docs=(await data()).collections[name].filter(r=>filters.every(([k,v])=>r[k]===v)).map(snap);return {docs,empty:!docs.length,size:docs.length,forEach:fn=>docs.forEach(fn)};}};return q;}};}
  function demoQR(){const host=document.getElementById('qrcode-container');if(!host)return;host.replaceChildren();if(window.QRCode)new QRCode(host,{text:'SE7:PREVIEW:SEM-VALIDADE',width:132,height:132,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});document.getElementById('badge-qr-status').textContent='QR demonstrativo • não registra presença';}
  // Dados cadastrais não podem criar scripts ou comandos no contexto master.
  const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  Object.defineProperty(Element.prototype,'innerHTML',{...html,set(value){const t=document.createElement('template');html.set.call(t,String(value));for(const node of t.content.querySelectorAll('*')){if(['SCRIPT','OBJECT','EMBED','BASE','META'].includes(node.tagName)){node.remove();continue;}for(const a of [...node.attributes]){const key=a.name.toLowerCase(),v=a.value;if(key.startsWith('on')&&!(key==='onclick'&&/^(?:mudarAba\('(?:home|financeiro|notas|frequencia|documentos|calendario)'\)|(?:baixarMaterialEstudoEJA|abrirTelaProvaOnlineEJA|fecharProvaOnlineEJA|fecharVisualizadorApostila)\(\)|enviarDocumentoPDFAluno\('[a-z_]+'\)|enviarProvaEJAAluno\(\d+\))$/.test(v)))node.removeAttribute(a.name);if(key==='srcdoc'||(['href','src','action','formaction','xlink:href'].includes(key)&&/^\s*(?:javascript|vbscript|data:(?!image\/(?:png|jpeg|webp);base64,))/i.test(v)))node.removeAttribute(a.name);}if(node.tagName==='IFRAME')node.setAttribute('sandbox','allow-scripts allow-same-origin');}html.set.call(this,html.get.call(t));}});
  window.SE7Preview={active:true,refresh,database,demoQR};
  SE7.studentLogin=SE7.staffLogin=SE7.recover=async()=>{throw Error(notice);};
  SE7.restore=async()=>{const r=await data();return profile(r.student);};
  SE7.logout=async()=>parent.postMessage({type:'se7-preview-close',channel},location.origin);
  SE7.api=async(action,b={})=>{
   if(action==='public-info'||action==='student-config')return {institution:(await data()).institution,gdriveUrl:''};
   if(action==='exam-results'||action==='exam-result')return request(action,b);
   if(action==='notices-feed'||action==='notices-open')return request(action,b);
   if(action==='asaas-payment'&&b.mode==='receipt')return request('receipt',{invoiceId:b.invoiceId});
   if(action==='asaas-invoices')return {invoices:(await data()).collections.financeLogs.map(f=>({...f,link:f.asaasPaymentId?{paymentId:f.asaasPaymentId}:null}))};
   if(action==='enrollment-finance-local')return {cancelled:0};
   throw Error(notice);
  };
  const fetchOriginal=window.fetch.bind(window);window.fetch=(input,init={})=>{const method=(init.method||(input instanceof Request?input.method:'GET')).toUpperCase();if(!['GET','HEAD'].includes(method))return Promise.reject(Error(notice));return fetchOriginal(input,init);};
  document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();alert(notice);},true);
  document.addEventListener('click',e=>{const n=e.target.closest('button,a,input');if(!n)return;const code=n.getAttribute('onclick')||'';if(/enviarDocumento|enviarProva|alterarAutorizacao|executarRedefinicao|salvarNovaSenha/.test(code)||n.type==='file'||n.id==='portal-whatsapp-opt-in'||n.textContent.trim()==='Li este aviso'){e.preventDefault();e.stopImmediatePropagation();alert(notice);}if(n.tagName==='A'){n.target='_blank';n.rel='noopener noreferrer';}},true);
  document.addEventListener('DOMContentLoaded',()=>{const strip=document.createElement('div');strip.style.cssText='position:fixed;top:0;left:0;right:0;z-index:5000;background:#173960;color:#fff;font:11px Arial;padding:4px;text-align:center;pointer-events:none';strip.textContent='Somente consulta • QR sem validade';document.body.append(strip);document.querySelectorAll('input[type=file],#portal-whatsapp-opt-in').forEach(n=>n.disabled=true);});
  return;
 }
 if(!location.pathname.endsWith('/')&&!location.pathname.endsWith('index.html'))return;
 let dialog,frame,channel,studentId,opening=false;
 const canPreview=()=>typeof usuarioMasterAtivo==='function'&&usuarioMasterAtivo()&&!sessionStorage.getItem('se7_matriz_perfil_visualizado');
 const style=document.createElement('style');style.textContent='.se7-preview-dialog{background:#091b34;color:#eef5ff;border:1px solid #315075;border-radius:18px;padding:16px;width:min(520px,94vw);max-height:94vh;box-sizing:border-box}.se7-preview-dialog::backdrop{background:#020915d9}.se7-preview-dialog header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.se7-preview-dialog button,#se7-portal-preview-launcher button{background:#245cb3;color:#fff;border:0;border-radius:9px;padding:9px 12px;cursor:pointer}.se7-preview-dialog iframe{box-sizing:border-box;display:block;width:390px;max-width:100%;height:min(700px,72vh);border:1px solid #385373;border-radius:16px;margin:auto;background:#07152b}#se7-portal-preview-launcher{padding:12px;border:1px solid #315075;border-radius:12px}#se7-portal-preview-launcher select{max-width:100%;padding:8px;background:#112d51;color:#fff;border-radius:8px;margin:8px}';document.head.append(style);
 const close=()=>{dialog?.close();};
 window.addEventListener('message',async e=>{
  if(e.origin!==location.origin||e.source!==frame?.contentWindow||e.data?.channel!==channel)return;
  if(e.data.type==='se7-preview-close'){close();return;}
  if(e.data.type!=='se7-preview-request')return;const {id,operation,data={}}=e.data,capturedFrame=frame,capturedChannel=channel,capturedStudent=studentId;
  try{if(!['snapshot','notices-feed','notices-open','receipt','exam-results','exam-result'].includes(operation))throw Error('Somente consulta.');const result=await SE7.api('portal-preview',{studentId:capturedStudent,operation,...(['notices-open','exam-result'].includes(operation)?{id:data.id}:operation==='receipt'?{invoiceId:data.invoiceId}:{})});if(frame===capturedFrame&&channel===capturedChannel)capturedFrame.contentWindow.postMessage({type:'se7-preview-response',channel:capturedChannel,id,result},location.origin);}
  catch(error){if(frame===capturedFrame)capturedFrame.contentWindow.postMessage({type:'se7-preview-response',channel:capturedChannel,id,error:error.message},location.origin);}
 });
 async function open(id){if(!canPreview()){alert('Acesso restrito ao perfil master.');return;}if(opening)return;opening=true;try{const r=await SE7.api('portal-preview',{studentId:id,operation:'snapshot'});close();studentId=id;channel=crypto.randomUUID();dialog=document.createElement('dialog');dialog.className='se7-preview-dialog';dialog.setAttribute('aria-label','Visualização do portal do aluno');const header=document.createElement('header'),title=document.createElement('strong'),exit=document.createElement('button');title.textContent='Modo de visualização — '+(r.student.fullname||'Aluno');exit.textContent='Fechar';exit.onclick=close;header.append(title,exit);const explanation=document.createElement('p');explanation.style.cssText='font-size:12px;margin:0 0 12px';explanation.textContent='Dados reais • somente consulta'+(r.student.portalBlocked?' • Acesso do aluno bloqueado':'')+(r.student.portalMustChangePassword?' • Aluno precisa trocar a senha':'');frame=document.createElement('iframe');frame.title='Portal de '+(r.student.fullname||'aluno');frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads');frame.src='/app-aluno.html?se7-preview=1#'+channel;dialog.append(header,explanation,frame);const current=dialog;current.addEventListener('close',()=>{current.remove();if(dialog===current){frame=null;dialog=null;channel=null;studentId=null;}});document.body.append(dialog);dialog.showModal();}
 catch(e){alert(e.message);}finally{opening=false;}}
 window.SE7PortalPreview={open,allowed:canPreview,visibility(allowed){document.querySelectorAll('[data-preview-student]').forEach(b=>b.hidden=!allowed||!canPreview());if(!allowed)close();}};
 document.addEventListener('click',e=>{const b=e.target.closest('[data-preview-student]');if(b){e.preventDefault();void open(b.dataset.previewStudent);}});
 document.addEventListener('DOMContentLoaded',()=>{firebase.auth().onAuthStateChanged(user=>{if(!user)close();});});
})();
