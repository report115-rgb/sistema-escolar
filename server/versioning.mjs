import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const appFiles={matriz:['assets/se7-matriz-finance.js','index.html','assets/se7-academic-entry.js','assets/se7-student-sheet.js','assets/se7-student-sheet.css','assets/se7-matriz.css','assets/se7-matriz.js','assets/se7-enrollment.js','assets/se7-documents.js','assets/se7-whatsapp.js'],aluno:['app-aluno.html'],financeiro:['app-financeiro.html'],totem:['totem.html','assets/se7-totem.js']};
const shared=['assets/se7-brand-symbol.svg','assets/vendor/se7-interface.ttf','assets/se7-brand.css','assets/se7-brand.js','assets/se7-brand-light.svg','assets/se7-brand-dark.svg','assets/se7-brand-icon.svg','server/scanner-access.mjs','server/academic-document-authorizations.mjs','assets/se7-document-models.js','assets/validar-documento.html','assets/se7-document-validation.js','server/academic-documents.mjs','assets/se7-academic-documents.js','assets/se7-template-editor.js','assets/se7-template-editor.css','assets/se7-tuition.js','server/course-configuration.mjs','server/notice-eligibility.mjs','assets/se7-busy.js','assets/se7-manual-grades.js','assets/se7-class-format.js','assets/se7-motion.js','server/class-registration.mjs','server/academic-ingress.mjs','assets/se7-ingress-policy.js','assets/se7-ingress.js','server/enrollment-asaas.mjs','assets/se7-enrollment-auto.js','server/security-handlers.mjs','assets/se7-security.js','assets/se7-security-handlers.js','assets/vendor/purify.min.js','assets/vendor/firebase-app-compat.js','assets/vendor/firebase-auth-compat.js','assets/vendor/firebase-firestore-compat.js','assets/vendor/tailwind.min.css','assets/vendor/confetti.browser.min.js','vercel.json','package.json','package-lock.json','server/exams.mjs','assets/se7-exams.js','assets/se7-exams.css','assets/se7-exam-student.js','assets/se7-exam-pdf.js','assets/se7-exam-omr.js','assets/vendor/jsQR.js','assets/vendor/qrcode.js','server/portal-preview.mjs','assets/se7-portal-preview.js','server/asaas-replacement.mjs','server/enrollment-finance.mjs','assets/se7-notices.js','assets/se7-notices.css','assets/se7-finance-batch.js','server/notices.mjs','server/finance-batch.mjs','assets/se7-email.js','server/email.mjs','assets/se7-auth.js','assets/se7-finance-dates.js','assets/se7-cadastro.js','assets/se7-receipt.js','assets/se7-cancellation.js','assets/vendor/pdf-lib.min.js','assets/se7-suite.css','assets/se7-version.js','api/se7.js','server/admin.mjs','server/security.mjs','server/whatsapp.mjs','server/asaas.mjs','server/asaas-bulk.mjs','api/asaas-webhook.js','assets/se7-asaas.js','assets/se7-asaas.css','firestore.rules'];
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
