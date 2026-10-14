import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const decode=value=>value.replace(/&(quot|apos|amp|lt|gt|#39);/g,(_,v)=>({quot:'"',apos:"'",amp:'&',lt:'<',gt:'>','#39':"'"}[v]));
export async function buildSafeHandlers(root=process.cwd()){
 const files=[...(await readdir(root)).filter(f=>f.endsWith('.html')),...(await readdir(resolve(root,'assets'))).filter(f=>f.endsWith('.js')&&!f.includes('security')).map(f=>'assets/'+f)];const patterns=new Set(),functions=new Set();
 for(const file of files){const source=await readFile(resolve(root,file),'utf8');for(const match of source.matchAll(/\bon(?:click|change|input)\s*=\s*(["'])(.*?)\1/gs)){const code=decode(match[2]);const pattern=code.split(/(\$\{.*?\})/g).map(part=>part.startsWith('${')?'(?:[-A-Za-z0-9_./:@ ]{1,180}|https://[^\\s"\\x27<>`]{1,1000})':escape(part)).join('');patterns.add('^'+pattern+'$');for(const call of code.matchAll(/(?:^|;)\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/g))functions.add(call[1]);}}
 for(const name of ['eval','Function','fetch','setTimeout','setInterval','alert','prompt','confirm','window.open','location.assign','window.location.assign','document.write'])functions.delete(name);
 const text='window.SE7SafeHandlerPatterns='+JSON.stringify([...patterns].sort())+';\nwindow.SE7SafeHandlerFunctions='+JSON.stringify([...functions].sort())+';\n';await writeFile(resolve(root,'assets/se7-security-handlers.js'),text);
}
