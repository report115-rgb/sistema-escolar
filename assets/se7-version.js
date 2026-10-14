/* Os rodapés consultam o mesmo manifesto; sem alterar dados do Firebase. */
(async()=>{
 try {
  const response=await fetch('/assets/se7-versions.json',{cache:'no-store'});
  if(!response.ok)return;
  const manifest=await response.json();
  document.querySelectorAll('[data-se7-version]').forEach(el=>{const app=manifest.apps?.[el.dataset.se7Version];if(app&&/^\d+\.\d+\.\d+$/.test(app.version))el.textContent='v'+app.version;});
 }catch{ /* Mantém a versão de segurança da página caso esteja offline. */ }
})();
