import {services} from '../server/admin.mjs';
import {applyWebhook,tokenMatches,config} from '../server/asaas.mjs';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{
 if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
 if(!config().enabled||!process.env.ASAAS_WEBHOOK_TOKEN)return res.status(503).json({error:'Webhook não ativado.'});
 if(!tokenMatches(req.headers['asaas-access-token'],process.env.ASAAS_WEBHOOK_TOKEN))return res.status(403).json({error:'Token inválido.'});
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!b||JSON.stringify(b).length>262144)return res.status(400).json({error:'Evento inválido.'});
 await applyWebhook(services().db,b);return res.status(200).json({received:true});
 }catch(e){console.error('SE7 Asaas webhook',e.status||500);return res.status(e.status===400?400:500).json({error:'Evento não concluído. Tente novamente.'});}}
