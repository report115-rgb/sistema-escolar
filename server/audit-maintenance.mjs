import {validId} from './security.mjs';
const fail=(s,m)=>{throw Object.assign(Error(m),{status:s});};
export async function clearAudit(db,b,u,now=new Date()){
 if(u.role!=='master')fail(403,'Limpeza da auditoria exclusiva do Master.');
 if(b.confirm!=='LIMPAR')fail(400,'Confirme a limpeza digitando LIMPAR.');
 const cutoff=typeof b.cutoff==='string'&&b.cutoff?b.cutoff:now.toISOString(),stamp=Date.parse(cutoff);if(!Number.isFinite(stamp)||new Date(stamp).toISOString()!==cutoff||stamp>now.getTime()+1000)fail(400,'Data de limpeza inválida.');
 let q=db.collection('systemLogs').orderBy('__name__').limit(250);if(b.cursor)q=q.startAfter(validId(b.cursor));const snap=await q.get();let removed=0;
 // A transaction rechecks each selected row before deletion. Entries created
 // after the fixed cutoff survive, including changes made during the cleanup.
 for(let i=0;i<snap.docs.length;i+=100){const chunk=snap.docs.slice(i,i+100);removed+=await db.runTransaction(async tx=>{const fresh=await Promise.all(chunk.map(d=>tx.get(d.ref)));let count=0;for(const d of fresh){if(!d.exists)continue;const value=d.data().createdAt,at=typeof value==='string'?Date.parse(value):typeof value==='number'?value:value?.toMillis?.();if(!Number.isFinite(at)||at<=stamp){tx.delete(d.ref);count++;}}return count;});}
 return {ok:true,removed,cursor:snap.docs.at(-1)?.id||'',more:snap.size===250,cutoff};
}
