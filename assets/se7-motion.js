(()=>{
 const selector='dialog,[role="dialog"],[id^="modal-"],.tab-content,.subtab-content,.subsubtab-content,.subsubtab-class-content,.tab-pane,[id^="tab-"]';
 const states=new WeakMap(),animations=new WeakMap(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const visible=e=>e.isConnected&&!e.hidden&&(!e.matches('dialog')||e.open)&&getComputedStyle(e).display!=='none';
 function enter(e){if(reduced.matches||!e.animate)return;const modal=e.matches('dialog,[role="dialog"],[id^="modal-"]');const panel=modal&&!e.matches('dialog')?(e.firstElementChild||e):e;animations.get(panel)?.cancel();const a=panel.animate([{opacity:0,transform:'translateY('+ (modal?'8':'5')+'px)'},{opacity:1,transform:'translateY(0)'}],{duration:modal?220:180,easing:'cubic-bezier(.22,1,.36,1)'});animations.set(panel,a);a.onfinish=()=>{if(animations.get(panel)===a)animations.delete(panel);};}
 window.SE7Motion=Object.freeze({enter});
 function start(){document.querySelectorAll(selector).forEach(e=>states.set(e,visible(e)));const observer=new MutationObserver(records=>{const changed=new Set();for(const r of records){if(r.type==='attributes'){if(r.target.matches(selector))changed.add(r.target);}else for(const node of r.addedNodes){if(node.nodeType!==1)continue;if(node.matches(selector))changed.add(node);node.querySelectorAll(selector).forEach(e=>changed.add(e));}}
 const entering=[];for(const e of changed){const shown=visible(e),before=states.get(e)??false;states.set(e,shown);if(shown&&!before)entering.push(e);}
 for(const e of entering){if(entering.some(parent=>parent!==e&&parent.contains(e)))continue;enter(e);}});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden','open']});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
