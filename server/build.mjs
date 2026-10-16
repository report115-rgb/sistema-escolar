import {writeFile,mkdir,rm,copyFile,cp} from 'node:fs/promises';
if(process.env.SE7_PLATFORM_PILOT!=='1'||!process.env.COMMERCIAL_FIREBASE_PROJECT_ID||process.env.COMMERCIAL_FIREBASE_PROJECT_ID==='sistema-escolar-nuvem'||!process.env.COMMERCIAL_FIREBASE_API_KEY||!process.env.COMMERCIAL_OWNER_UID)throw Error('Use esta versão somente em uma nova implantação de testes, com o projeto comercial.');
const cfg={apiKey:process.env.COMMERCIAL_FIREBASE_API_KEY,projectId:process.env.COMMERCIAL_FIREBASE_PROJECT_ID,authDomain:process.env.COMMERCIAL_FIREBASE_PROJECT_ID+'.firebaseapp.com',ownerUid:process.env.COMMERCIAL_OWNER_UID};
await writeFile('assets/se7-platform-config.js','window.SE7PlatformConfig='+JSON.stringify(cfg)+';');
const {validateServerDependencies}=await import('./deployment-files.mjs');await validateServerDependencies();const {buildSafeHandlers}=await import('./security-handlers.mjs');await buildSafeHandlers();
await rm('public',{recursive:true,force:true});await mkdir('public',{recursive:true});await copyFile('index.html','public/index.html');await cp('assets','public/assets',{recursive:true});
