// O Portal do Aluno exige rede para autenticacao e dados. Nenhum dado sensivel e armazenado em cache.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Nao interceptar requisicoes: HTML, API e autenticacao seguem diretamente para a rede.
