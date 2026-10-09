import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
export {FieldValue};
export function services(){
 if(!getApps().length){const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;if(!raw)throw new Error('Credencial administrativa não configurada.');const c=JSON.parse(raw);if(c.project_id!=='sistema-escolar-nuvem')throw new Error('Projeto Firebase incorreto.');initializeApp({credential:cert(c),projectId:c.project_id});}
 return {auth:getAuth(),db:getFirestore()};
}
