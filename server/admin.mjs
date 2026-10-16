import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
export {FieldValue};
export function services(){
 if(process.env.VERCEL_ENV==='production'&&(process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.FIRESTORE_EMULATOR_HOST))throw new Error('Configuração de emulador não permitida em produção.');
 if(!getApps().length){const raw=process.env.COMMERCIAL_SERVICE_ACCOUNT_JSON;if(!raw)throw new Error('Credencial administrativa não configurada.');const c=JSON.parse(raw);if(process.env.SE7_PLATFORM_PILOT!=='1'||!process.env.COMMERCIAL_FIREBASE_PROJECT_ID||c.project_id!==process.env.COMMERCIAL_FIREBASE_PROJECT_ID||c.project_id==='sistema-escolar-nuvem')throw new Error('Projeto Firebase incorreto.');initializeApp({credential:cert(c),projectId:c.project_id});}
 return {auth:getAuth(),db:getFirestore()};
}
