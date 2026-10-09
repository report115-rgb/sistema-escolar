import {mkdir,copyFile,cp,rm} from 'node:fs/promises';
await rm('public',{recursive:true,force:true});await mkdir('public',{recursive:true});
for(const f of ['index.html','app-aluno.html','app-financeiro.html','totem.html','administracao-auth.html'])await copyFile(f,'public/'+f);
await cp('assets','public/assets',{recursive:true});
