import {Timestamp,GeoPoint} from 'firebase-admin/firestore';
const fail=(s,m)=>{throw Object.assign(Error(m),{status:s});};
export const excluded=['se7RateLimits','se7AttendanceQr'];
export function encode(v){
 if(v===null||typeof v==='string'||typeof v==='boolean')return ['scalar',v];
 if(typeof v==='number')return ['number',Number.isNaN(v)?'NaN':v===Infinity?'Infinity':v===-Infinity?'-Infinity':Object.is(v,-0)?'-0':v];
 if(v instanceof Timestamp)return ['timestamp',v.seconds,v.nanoseconds];
 if(v instanceof GeoPoint)return ['geo',v.latitude,v.longitude];
 if(Buffer.isBuffer(v)||v instanceof Uint8Array)return ['bytes',Buffer.from(v).toString('base64')];
 if(v instanceof Date)return ['timestamp',Math.floor(v.getTime()/1000),(v.getTime()%1000)*1000000];
 if(v&&typeof v.path==='string'&&typeof v.get==='function'&&v.firestore)return ['reference',v.path];
 if(Array.isArray(v))return ['array',v.map(encode)];
 if(v&&typeof v==='object')return ['map',Object.entries(v).map(([k,x])=>[k,encode(x)])];
 throw Error('Tipo de dado não suportado no backup.');
}
export function decode(v,db){
 if(!Array.isArray(v))throw Error('Dado de backup inválido.');
 const [t,a,b]=v;
 if(t==='scalar')return a;
 if(t==='number')return typeof a==='number'?a:({'NaN':NaN,'Infinity':Infinity,'-Infinity':-Infinity,'-0':-0})[a];
 if(t==='timestamp')return new Timestamp(a,b);
 if(t==='geo')return new GeoPoint(a,b);
 if(t==='bytes')return Buffer.from(a,'base64');
 if(t==='reference')return db.doc(a);
 if(t==='array')return a.map(x=>decode(x,db));
 if(t==='map'){const o={};for(const [k,x]of a)Object.defineProperty(o,k,{value:decode(x,db),writable:true,enumerable:true,configurable:true});return o;}
 throw Error('Tipo de backup inválido.');
}
export async function dispatch(db,auth,b,u){
 if(u.role!=='master'||u.uid!==process.env.SE7_MASTER_UID)fail(403,'Backup exclusivo do master.');
 if(b.action==='backup-catalog')return {project:'sistema-escolar-nuvem',collections:(await db.listCollections()).map(c=>c.path).filter(p=>!excluded.includes(p)),excluded,startedAt:new Date().toISOString()};
 if(b.action==='backup-page'){
  const p=b.path;if(typeof p!=='string'||p.length>1500||p.split('/').length%2!==1||p.split('/').some(x=>!x||x==='.'||x==='..')||excluded.includes(p.split('/')[0]))fail(400,'Coleção inválida.');
  const offset=b.offset??0;if(!Number.isSafeInteger(offset)||offset<0||offset>100000)fail(400,'Página inválida.');
  // listDocuments inclui pais ausentes que ainda possuem subcoleções.
  const refs=(await db.collection(p).listDocuments()).sort((a,c)=>a.path.localeCompare(c.path));
  if(refs.length>100000)fail(413,'Coleção muito grande para este método.');
  const rows=[];for(const ref of refs.slice(offset,offset+3)){const snap=await ref.get();rows.push({path:ref.path,exists:snap.exists,data:snap.exists?encode(snap.data()):null,collections:(await ref.listCollections()).map(c=>c.path)});}
  return {rows,total:refs.length,next:offset+3<refs.length?offset+3:null};
 }
 if(b.action==='backup-users'){
  if(b.pageToken!==undefined&&(typeof b.pageToken!=='string'||b.pageToken.length>2000))fail(400,'Página inválida.');
  const r=await auth.listUsers(100,b.pageToken);return {users:r.users.map(user=>{const d=user.toJSON();delete d.passwordHash;delete d.passwordSalt;return d;}),next:r.pageToken||null};
 }
 fail(400,'Operação de backup inválida.');
}
