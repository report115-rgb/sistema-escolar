import {timingSafeEqual} from 'node:crypto';
import {services} from '../server/admin.mjs';
import {verifySignature,applyWebhook} from '../server/whatsapp.mjs';
const reply=(text,status=200)=>new Response(text,{status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});
const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export async function GET(request){const q=new URL(request.url).searchParams;
 if(q.get('hub.mode')==='subscribe'&&process.env.WHATSAPP_VERIFY_TOKEN&&same(q.get('hub.verify_token'),process.env.WHATSAPP_VERIFY_TOKEN)&&q.get('hub.challenge')?.length<=128)return reply(q.get('hub.challenge'));
 return reply('Verificação recusada.',403);
}
export async function POST(request){try{
 if(!process.env.WHATSAPP_APP_SECRET)return reply('Webhook não configurado.',503);
 const chunks=[];let size=0;const reader=request.body?.getReader();if(!reader)return reply('Conteúdo ausente.',400);
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return reply('Conteúdo grande demais.',413);}chunks.push(Buffer.from(value));}
 const raw=Buffer.concat(chunks);
 if(!verifySignature(raw,request.headers.get('x-hub-signature-256'),process.env.WHATSAPP_APP_SECRET))return reply('Assinatura inválida.',403);
 let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{return reply('JSON inválido.',400);}
 await applyWebhook(services().db,payload);return reply('EVENT_RECEIVED');
 }catch{console.error('SE7 WhatsApp webhook: processamento não concluído.');return reply('Tente novamente.',500);}}
