// Portal do Aluno: cache somente do HTML publico; nunca cachear dados do aluno ou APIs.
const CACHE='se7-aluno-shell-v1';
const SHELL='/app-aluno.html';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.add(SHELL)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('se7-aluno-shell-')&&key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.mode!=='navigate'||new URL(request.url).pathname!==SHELL)return;
  event.respondWith(fetch(request).catch(()=>caches.match(SHELL).then(cached=>cached||Response.error())));
});
