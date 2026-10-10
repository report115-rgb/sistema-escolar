import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const appFiles={matriz:['index.html','assets/se7-matriz.css','assets/se7-matriz.js','assets/se7-enrollment.js','assets/se7-documents.js','assets/se7-whatsapp.js'],aluno:['app-aluno.html'],financeiro:['app-financeiro.html'],totem:['totem.html','assets/se7-totem.js']};
const shared=['assets/se7-email.js','server/email.mjs','assets/se7-auth.js','assets/se7-finance-dates.js','assets/se7-cadastro.js','assets/se7-receipt.js','assets/se7-cancellation.js','assets/vendor/pdf-lib.min.js','assets/se7-suite.css','assets/se7-version.js','api/se7.js','server/admin.mjs','server/security.mjs','server/whatsapp.mjs','server/asaas.mjs','server/asaas-bulk.mjs','api/asaas-webhook.js','assets/se7-asaas.js','assets/se7-asaas.css','firestore.rules'];
export async function updateVersions(root=process.cwd(),kind='patch'){
 if(!['patch','minor','major'].includes(kind))throw Error('Tipo de versão inválido.');
 const file=resolve(root,'assets/se7-versions.json');const manifest=JSON.parse(await readFile(file,'utf8'));let changed=false;
 for(const [name,files] of Object.entries(appFiles)){
  const hash=createHash('sha256');for(const path of [...files,...shared]){hash.update(path);let content=await readFile(resolve(root,path));if(path.endsWith('.html'))content=content.toString().replace(/(<span\b[^>]*data-se7-version="[^"]+"[^>]*>)v\d+\.\d+\.\d+(<\/span>)/g,'$1vVERSION$2');hash.update(content);}
  const revision=hash.digest('hex'),entry=manifest.apps[name];
  if(!entry||!/^\d+\.\d+\.\d+$/.test(entry.version))throw Error('Versão inválida: '+name);
  if(entry.revision===revision)continue;
  if(entry.revision){let [major,minor,patch]=entry.version.split('.').map(Number);if(kind==='major'){major++;minor=patch=0;}else if(kind==='minor'){minor++;patch=0;}else patch++;entry.version=[major,minor,patch].join('.');}
  entry.revision=revision;changed=true;
 }
 if(changed)await writeFile(file,JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const kind=process.argv[2]||'patch';const result=await updateVersions(process.cwd(),kind);console.log(Object.entries(result.apps).map(([app,v])=>app+': v'+v.version).join('\n'));}
