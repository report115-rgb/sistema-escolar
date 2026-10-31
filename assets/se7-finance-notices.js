(function(){
'use strict';
let count=0,lastShown=0,lastStudent='',timer=null;
const day=v=>{if(!v)return '';try{return window.SE7Finance?.dateISO(v)||'';}catch{return '';}};
const eligible=f=>{
 const type=String(f.type||f.tipo||f.category||f.categoria||f.description||f.descricao||'').toLowerCase();
 const status=String(f.status||'').toUpperCase();
 const due=day(f.date||f.vencimento||f.dueDate);
 const paid=/^(PAGO|PAGA|QUITADO|QUITADA)(?:$|[\\s(])|^(RECEIVED|CONFIRMED|RECEIVED_IN_CASH)$/.test(status)||!!(f.dataPagamento||f.paymentDate);
 const cancelled=/CANCELAD|NEGOCIAD|ESTORNAD|CONTESTAD|PROPOSTA|ACORDO|REPLACED/.test(status);
 return due&&due<day(new Date())&&!paid&&!cancelled&&!/matr[ií]cula|taxa de prova|multa de prova|material|acordo/.test(type);
};
const style=document.createElement('style');style.textContent='#se7-overdue-notice{position:fixed;top:66px;left:50%;transform:translateX(-50%);width:min(440px,calc(100% - 24px));z-index:10500;background:#0b2035;color:#f8fafc;border:1px solid #547da4;border-left:5px solid #f59e0b;border-radius:14px;padding:15px 16px;box-shadow:0 12px 36px #02061777;font:13px/1.55 system-ui,sans-serif}#se7-overdue-notice strong{display:block;font-size:15px;margin-bottom:5px}#se7-overdue-notice .se7-ov-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:9px}#se7-overdue-notice button{cursor:pointer;border:1px solid #64748b;border-radius:7px;padding:6px 9px;color:white;background:transparent}#se7-overdue-notice button.se7-ov-fin{background:#155eaf;border-color:#155eaf}';document.head.append(style);
function hide(){document.getElementById('se7-overdue-notice')?.remove();}
function show(force=false){
 if(!count||!lastStudent||document.hidden||window.SE7Preview?.active||window.SE7AdminPortal?.active)return;
 const level=count>=3?3:count===2?2:1,interval=level===3?120000:level===2?180000:240000;
 if(!force&&Date.now()-lastShown<interval)return;
 if(document.getElementById('se7-overdue-notice'))return;
 lastShown=Date.now();
 const title=level===3?'Atenção à sua situação financeira':level===2?'Pendências financeiras importantes':'Aviso financeiro';
 const msg=level===3?'Há três ou mais mensalidades pendentes. Procure o setor financeiro para conhecer as opções de regularização e evitar consequências contratuais previstas em lei.':level===2?'Identificamos duas mensalidades em atraso. Consulte suas pendências e as possibilidades de negociação.':'Identificamos uma mensalidade em atraso. Consulte o setor financeiro para regularizar sua situação.';
 const box=document.createElement('section');box.id='se7-overdue-notice';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
 const h=document.createElement('strong');h.textContent=title;const p=document.createElement('div');p.textContent=msg;const actions=document.createElement('div');actions.className='se7-ov-actions';
 const close=document.createElement('button');close.type='button';close.textContent='Entendi';close.onclick=hide;
 const go=document.createElement('button');go.type='button';go.className='se7-ov-fin';go.textContent='Ver financeiro';go.onclick=()=>{hide();if(typeof window.mudarAba==='function')window.mudarAba('financeiro');else document.getElementById('nav-financeiro')?.click();};
 actions.append(close,go);box.append(h,p,actions);document.body.append(box);
 setTimeout(()=>{if(box.isConnected)box.remove();},15000);
}
window.SE7FinanceNotices={
 update(faturas,id){if(!id)return; if(lastStudent!==id){lastStudent=id;lastShown=0;hide();}const ids=new Set();count=0;for(const f of Array.isArray(faturas)?faturas:[]){if(!eligible(f))continue;const key=String(f.asaasPaymentId||f.paymentId||f.invoiceId||f.id||f.date||f.vencimento||count);if(!ids.has(key)){ids.add(key);count++;}}if(!count){hide();lastShown=0;return;}show();},
 navigation(tab){if(tab!=='financeiro')show();},
 reset(){count=0;lastStudent='';lastShown=0;hide();}
};
setInterval(()=>{if(!count||document.hidden||!lastStudent)return;show();},30000);
})();