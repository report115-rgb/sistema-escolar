import {readFile,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
/** Validate the actual API import graph before publishing static pages. */
export async function validateServerDependencies(root=process.cwd(),entries=['api/se7.js','api/asaas-webhook.js','api/whatsapp-webhook.js']){
 root=resolve(root);const visited=new Set();
 async function visit(file,parent='entrada da API'){
  const path=resolve(root,file),key=relative(root,path);
  if(key.startsWith('..')||isAbsolute(key))throw Error('Dependência fora do projeto: '+file);
  if(visited.has(key))return;
  let source;try{if(!(await stat(path)).isFile())throw Error('not a file');source=await readFile(path,'utf8');}catch{throw Error('Implantação incompleta: falta '+key+' (usado por '+parent+'). Envie o arquivo mantendo as pastas do projeto.');}
  visited.add(key);
  for(const match of source.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g))await visit(relative(root,resolve(path,'..',match[1])),key);
 }
 for(const file of entries)await visit(file);
 return [...visited].sort();
}
