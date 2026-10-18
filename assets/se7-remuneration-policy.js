// One rate per competence. Historical paid snapshots are never recalculated here.
export function monthNow(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);}
export function numericMoney(v){if(typeof v==='number')return v;const s=String(v??'0');return Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);}
export function compensationAt(t,month){return [...(t?.compensationHistory||[])].filter(x=>x.from<=month).sort((a,b)=>b.from.localeCompare(a.from))[0]||null;}
export function hourlyRate(t,legacy,month){const c=compensationAt(t,month);if(c)return c.kind==='hourly'?c.amountCents/100:0;return numericMoney(legacy?.valorHora??t?.valorHora??t?.valorHoraAula??t?.valor_hora??t?.horaValor??0);}
