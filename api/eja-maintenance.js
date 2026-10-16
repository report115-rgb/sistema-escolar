import {services} from '../server/admin.mjs';
import {tokenMatches} from '../server/asaas.mjs';
import {tick} from '../server/eja-workflow.mjs';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:'Método não permitido.'});if(!tokenMatches(String(req.headers.authorization||''),'Bearer '+String(process.env.CRON_SECRET||''))||!process.env.CRON_SECRET||process.env.CRON_SECRET.length<32)return res.status(401).json({error:'Acesso não autorizado.'});try{return res.status(200).json(await tick(services().db));}catch{return res.status(500).json({error:'Conciliação EJA pendente. Confira os registros.'});}}
