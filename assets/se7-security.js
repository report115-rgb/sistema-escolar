/* Proteção de HTML dinâmico: dados do banco não podem criar scripts ou eventos automáticos. */
(()=>{
 if(!window.DOMPurify)throw Error('Proteção do sistema indisponível. Atualize a página.');
 let printing=false;
 const patterns=(window.SE7SafeHandlerPatterns||[]).map(p=>new RegExp(p)),functions=new Set(window.SE7SafeHandlerFunctions||[]);
 const literal=String.raw`(?:'(?:[^'\\\r\n]|\\['\\])*'|"(?:[^"\\\r\n]|\\["\\])*"|-?\d+(?:\.\d+)?|true|false|null|event|this)`;
 const call=new RegExp(String.raw`^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(\s*(?:${literal}(?:\s*,\s*${literal})*)?\s*\)\s*;?\s*$`);
 const trusted=code=>{if(typeof code!=='string'||code.length>4000)return false;if(patterns.some(p=>p.test(code)))return true;const m=call.exec(code);return !!m&&functions.has(m[1]);};
 DOMPurify.addHook('uponSanitizeAttribute',(node,data)=>{if(data.attrName.startsWith('on')){data.keepAttr=false;if(!printing&&['onclick','onchange','oninput'].includes(data.attrName)&&trusted(data.attrValue)){data.forceKeepAttr=true;data.keepAttr=true;}}});
 const config={ADD_TAGS:['iframe'],ADD_ATTR:['onclick','onchange','oninput','target','sandbox','allow','download'],FORBID_TAGS:['script','object','embed','base','meta','link'],FORBID_ATTR:['srcdoc'],SANITIZE_DOM:true};
 let sanitizing=false;
 const clean=(value,context='')=>{if(sanitizing)return String(value??'');sanitizing=true;try{const tag=String(context).toLowerCase(),table=['table','tbody','thead','tfoot','tr'].includes(tag),raw=String(value??'');if(!table)return DOMPurify.sanitize(raw,config);const wrapped=tag==='table'?'<table>'+raw+'</table>':tag==='tr'?'<table><tbody><tr>'+raw+'</tr></tbody></table>':'<table><'+tag+'>'+raw+'</'+tag+'></table>';const purified=DOMPurify.sanitize(wrapped,config),doc=new DOMParser().parseFromString(purified,'text/html');return doc.querySelector(tag)?.innerHTML||'';}finally{sanitizing=false;}};
 const inner=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');Object.defineProperty(Element.prototype,'innerHTML',{...inner,set(value){inner.set.call(this,clean(value,this.tagName));}});
 const adjacent=Element.prototype.insertAdjacentHTML;Element.prototype.insertAdjacentHTML=function(position,value){return adjacent.call(this,position,clean(value,['beforebegin','afterend'].includes(String(position).toLowerCase())?this.parentElement?.tagName:this.tagName));};
 window.SE7Safe={html:clean,document:value=>{sanitizing=true;printing=true;try{return DOMPurify.sanitize(String(value??''),{...config,WHOLE_DOCUMENT:true,FORBID_ATTR:[...config.FORBID_ATTR,'onclick','onchange','oninput']});}finally{sanitizing=false;printing=false;}},escape:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),trustedHandler:trusted};
})();
