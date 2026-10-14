import {decode} from './backup.mjs';
// Recuperação deliberadamente limitada ao emulador. Não há endpoint de restauração em produção.
export async function restoreToEmulator(db,backup){
 const project=db.projectId;
 if(!process.env.FIRESTORE_EMULATOR_HOST||!/^demo-/.test(project))throw Error('Recuperação permitida apenas em banco de teste demo e emulador.');
 if(backup?.format!=='SE7-DATA-BACKUP'||backup.version!==1||backup.project!=='sistema-escolar-nuvem'||!Array.isArray(backup.documents))throw Error('Backup inválido.');
 const seen=new Set();for(const row of backup.documents){if(typeof row.path!=='string'||row.path.split('/').length%2!==0||row.path.split('/').some(x=>!x||x==='.'||x==='..')||seen.has(row.path))throw Error('Caminho duplicado ou inválido.');seen.add(row.path);if(row.exists)decode(row.data,db);}
 let count=0;for(const row of backup.documents){if(!row.exists)continue;await db.doc(row.path).set(decode(row.data,db));count++;}return {restored:count,authRestored:false,driveRestored:false};
}
