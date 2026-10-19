import {validateServerDependencies} from './deployment-files.mjs';
await validateServerDependencies(process.cwd(),['api/se7.js','api/asaas-webhook.js','api/whatsapp-webhook.js','api/eja-maintenance.js','api/annual-statements.js']);
import {buildSafeHandlers} from './security-handlers.mjs';
await buildSafeHandlers();
import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
await rm('public',{recursive:true,force:true});await mkdir('public',{recursive:true});
for(const f of ['index.html','app-aluno.html','app-preceptor.html','app-financeiro.html','totem.html','administracao-auth.html','validar-relatorio.html'])await copyFile(f,'public/'+f);
await cp('assets','public/assets',{recursive:true});
