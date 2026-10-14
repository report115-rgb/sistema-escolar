import {Timestamp,GeoPoint} from 'firebase-admin/firestore';
import {getApp} from 'firebase-admin/app';
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
 if(t==='integer'){const n=BigInt(a);return n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(Number.MIN_SAFE_INTEGER)?Number(n):n;}
 if(t==='timestamp')return new Timestamp(a,b);
 if(t==='geo')return new GeoPoint(a,b);
 if(t==='bytes')return Buffer.from(a,'base64');
 if(t==='reference')return db.doc(a);
 if(t==='array')return a.map(x=>decode(x,db));
 if(t==='map'){const o={};for(const [k,x]of a)Object.defineProperty(o,k,{value:decode(x,db),writable:true,enumerable:true,configurable:true});return o;}
 throw Error('Tipo de backup inválido.');
}
let cachedToken;
async function rest(db,path,query={},body){
 const project=db.projectId,emulator=process.env.FIRESTORE_EMULATOR_HOST;
 if(emulator&&!project.startsWith('demo-'))fail(503,'Backup recusado: configuração de emulador em projeto real.');
 const base=emulator?'http://'+emulator:'https://firestore.googleapis.com';
 const headers={'Content-Type':'application/json'};if(emulator)headers.Authorization='Bearer owner';
 if(!emulator){if(!cachedToken||cachedToken.expires<Date.now()+60000){let timer;try{const token=await Promise.race([getApp().options.credential.getAccessToken(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Autorização do backup demorou demais.')),10000);})]);cachedToken={value:token.access_token,expires:Date.now()+token.expires_in*1000};}finally{clearTimeout(timer);}}headers.Authorization='Bearer '+cachedToken.value;}
 const prefix='projects/'+encodeURIComponent(project)+'/databases/(default)/documents';
 const url=new URL(base+'/v1/'+prefix+(path?'/'+path.split('/').map(encodeURIComponent).join('/'):''));
 if(body)url.pathname+=':listCollectionIds';for(const [k,v]of Object.entries(query))if(v!==undefined&&v!==null)url.searchParams.set(k,String(v));
 let r;try{r=await fetch(url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});}catch{fail(503,'Leitura do backup demorou demais nesta página. Tente novamente.');}
 if(!r.ok)fail(r.status===403?403:503,'Firebase recusou a leitura do backup (HTTP '+r.status+').');return r.json();
}
function restValue(v){
 if('nullValue'in v)return ['scalar',null];if('stringValue'in v)return ['scalar',v.stringValue];if('booleanValue'in v)return ['scalar',v.booleanValue];
 if('integerValue'in v)return ['integer',v.integerValue];if('doubleValue'in v)return ['number',v.doubleValue];
 if('timestampValue'in v){const m=/^(.*?)(?:\.(\d+))?Z$/.exec(v.timestampValue);return ['timestamp',Date.parse(m[1]+'Z')/1000,Number((m[2]||'').padEnd(9,'0'))];}
 if('bytesValue'in v)return ['bytes',v.bytesValue];if('referenceValue'in v)return ['reference',v.referenceValue.split('/documents/')[1]];
 if('geoPointValue'in v)return ['geo',v.geoPointValue.latitude,v.geoPointValue.longitude];
 if('arrayValue'in v)return ['array',(v.arrayValue.values||[]).map(restValue)];
 if('mapValue'in v)return ['map',Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,restValue(x)])];
 throw Error('Tipo de dado não suportado no backup.');
}
export async function dispatch(db,auth,b,u){
 if(u.role!=='master'||u.uid!==process.env.SE7_MASTER_UID)fail(403,'Backup exclusivo do master.');
 if(b.pageToken!==undefined&&(typeof b.pageToken!=='string'||b.pageToken.length>4000))fail(400,'Página inválida.');
 if(b.action==='backup-catalog'){const r=await rest(db,'',{}, {pageSize:100,...(b.pageToken?{pageToken:b.pageToken}:{})});return {project:'sistema-escolar-nuvem',collections:(r.collectionIds||[]).filter(p=>!excluded.includes(p)),next:r.nextPageToken||null,excluded,startedAt:new Date().toISOString()};}
 if(b.action==='backup-children'){
  const p=b.path;if(typeof p!=='string'||p.length>1500||p.split('/').length%2!==0||p.split('/').some(x=>!x||x==='.'||x==='..'))fail(400,'Documento inválido.');
  const r=await rest(db,p,{}, {pageSize:100,...(b.pageToken?{pageToken:b.pageToken}:{})});return {collections:(r.collectionIds||[]).map(id=>p+'/'+id),next:r.nextPageToken||null};
 }
 if(b.action==='backup-page'){
  const p=b.path;if(typeof p!=='string'||p.length>1500||p.split('/').length%2!==1||p.split('/').some(x=>!x||x==='.'||x==='..')||excluded.includes(p.split('/')[0]))fail(400,'Coleção inválida.');
  // Paginação no próprio Firebase: nunca busca a coleção inteira.
  const r=await rest(db,p,{pageSize:1,showMissing:true,pageToken:b.pageToken});const rows=[];
  for(const d of r.documents||[]){const path=d.name.split('/documents/')[1],child=await rest(db,path,{}, {pageSize:100});rows.push({path,exists:!!d.createTime,data:d.createTime?['map',Object.entries(d.fields||{}).map(([k,v])=>[k,restValue(v)])]:null,collections:(child.collectionIds||[]).map(id=>path+'/'+id),childrenNext:child.nextPageToken||null});}
  return {rows,next:r.nextPageToken||null};
 }
 if(b.action==='backup-users'){
  if(b.pageToken!==undefined&&(typeof b.pageToken!=='string'||b.pageToken.length>2000))fail(400,'Página inválida.');
  const r=await auth.listUsers(100,b.pageToken);return {users:r.users.map(user=>{const d=user.toJSON();delete d.passwordHash;delete d.passwordSalt;return d;}),next:r.pageToken||null};
 }
 fail(400,'Operação de backup inválida.');
}
