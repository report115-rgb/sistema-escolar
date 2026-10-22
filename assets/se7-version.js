/* Os rodapés consultam o mesmo manifesto; sem alterar dados do Firebase. */
(async()=>{
 try {
  const response=await fetch('/assets/se7-versions.json?rev='+encodeURIComponent(document.documentElement.dataset.se7Build||Date.now()),{cache:'no-store'});
  if(!response.ok)return;
  const manifest=await response.json();
  document.querySelectorAll('[data-se7-version]').forEach(el=>{const app=manifest.apps?.[el.dataset.se7Version];if(app&&/^\d+\.\d+\.\d+(?:\+[a-f0-9]{8})?$/.test(app.version))el.textContent='v'+app.version.split('+')[0];});
 }catch{ /* Mantém a versão de segurança da página caso esteja offline. */ }
})();
