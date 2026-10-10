(() => {
 const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
 function dateISO(value){
  if(value instanceof Date||value&&typeof value.toDate==='function'||value&&typeof value.seconds==='number'){
   const d=value instanceof Date?value:typeof value.toDate==='function'?value.toDate():new Date(value.seconds*1000);if(Number.isNaN(d.getTime()))return '';
   const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');
  }
  const s=String(value??'').trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);if(!m){const b=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!b)return '';m=[b[0],b[3],b[2],b[1]];}
  const iso=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'),d=new Date(iso+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';
 }
 const dateBR=(value,fallback='---')=>{const iso=dateISO(value);return iso?iso.split('-').reverse().join('/'):fallback;};
 const compare=(a,b)=>{const x=dateISO(a.date||a.vencimento||a.dueDate)||'9999-99-99',y=dateISO(b.date||b.vencimento||b.dueDate)||'9999-99-99';return x.localeCompare(y)||collator.compare(a.description||a.descricao||'',b.description||b.descricao||'')||String(a.id||'').localeCompare(String(b.id||''));};
 const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
 const paymentText=f=>{if(f.asaasReview)return 'Pagamento em conferência pelo financeiro';if(!Number.isSafeInteger(f.asaasPaidValueCents))return '';const parts=['Valor pago: '+money(f.asaasPaidValueCents)];if(f.asaasDiscountCents>0)parts.push('Desconto aplicado: '+money(f.asaasDiscountCents));if(f.asaasSurchargeCents>0)parts.push('Acréscimos: '+money(f.asaasSurchargeCents));return parts.join(' • ');};
 window.SE7Finance=Object.freeze({dateISO,dateBR,compare,money,paymentText,sort:rows=>rows.sort(compare)});
})();
