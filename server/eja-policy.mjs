const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export const isEja=c=>/^(eja|supletivo)$/i.test(String(c?.nivel||'').trim())||/^eja$/i.test(String(c?.sigla||'').trim())||/eja|supletivo/i.test(c?.name||'');
export const localDate=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function addDays(date,n){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)fail(400,'Data inválida.');const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export const defaultSettings=()=>({active:false,cashCents:140000,installmentCents:150000,revision:0});
export function settings(input){const s={active:input?.active===true,cashCents:input?.cashCents??140000,installmentCents:input?.installmentCents??150000,revision:input?.revision??0};if(!Number.isInteger(s.revision)||s.revision<0)fail(400,'Versão das condições inválida.');if(!Number.isInteger(s.cashCents)||s.cashCents<100||s.cashCents>10000000||!Number.isInteger(s.installmentCents)||s.installmentCents<s.cashCents||s.installmentCents>10000000||s.installmentCents%2)fail(400,'Confira os valores; o parcelado deve permitir duas parcelas iguais em centavos.');return s;}
export function contractFor(input,cfg,now=new Date()){
 if(!cfg.active)fail(409,'As condições da EJA ainda não foram ativadas.');if(!['cash','boleto','card'].includes(input.paymentMode))fail(400,'Escolha a forma de pagamento da EJA.');if(input.pricingRevision!==cfg.revision)fail(409,'As condições da EJA foram atualizadas. Confira novamente antes de concluir.');
 const date=localDate(now),parts=input.paymentMode==='card'?Number(input.cardInstallments||2):input.paymentMode==='boleto'?2:1;if(![1,2].includes(parts))fail(400,'Escolha uma ou duas parcelas no cartão.');return {version:1,paymentMode:input.paymentMode,cardInstallments:input.paymentMode==='card'?parts:0,totalCents:input.paymentMode==='cash'?cfg.cashCents:cfg.installmentCents,firstCents:input.paymentMode==='boleto'?cfg.installmentCents/2:input.paymentMode==='cash'?cfg.cashCents:cfg.installmentCents,secondCents:input.paymentMode==='boleto'?cfg.installmentCents/2:0,enrollmentDate:date,enrollmentConfirmedAt:now.toISOString(),earliestExamDate:addDays(date,30),firstDueDate:addDays(date,2),paymentState:'pending',firstPaymentConfirmedAt:null,pricingRevision:cfg.revision};
}
export function windowFor(date){addDays(date,0);return {startAt:date+'T08:00:00-03:00',cutoffAt:date+'T20:00:00-03:00',deadlineAt:date+'T20:20:00-03:00'};}
export function questionsFor(config){
 if(!config?.provaAtiva)fail(409,'A prova ainda não foi ativada pela secretaria.');
 const groups=Array.isArray(config.provasPorDisciplina)&&config.provasPorDisciplina.length?config.provasPorDisciplina:null;
 const source=groups?groups.flatMap(g=>(g.questoes||[]).map(q=>({...q,disciplinaId:String(g.id),disciplinaNome:String(g.nome)}))):config.questoes;
 if(!Array.isArray(source)||!source.length||source.length>100)fail(409,'Cadastre as questões antes de liberar a prova.');
 if(groups&&groups.some(g=>!g.nome||!Array.isArray(g.questoes)||g.questoes.length!==5))fail(409,'Cada disciplina precisa conter cinco questões.');
 return source.map(q=>{if(typeof q.enunciado!=='string'||!q.enunciado.trim()||q.enunciado.length>6000||!Array.isArray(q.opcoes)||q.opcoes.length!==5||q.opcoes.some(o=>typeof o!=='string'||!o.trim()||o.length>3000)||!Number.isInteger(Number(q.correta))||Number(q.correta)<0||Number(q.correta)>=5)fail(409,'Há questões incompletas.');return {enunciado:q.enunciado,opcoes:q.opcoes,correta:Number(q.correta),disciplinaId:q.disciplinaId||'legado',disciplinaNome:q.disciplinaNome||'Prova EJA'};});
}
export function score(questions,answers){
 const correct=questions.reduce((sum,q,i)=>sum+(answers[String(i)]===q.correta?1:0),0),grade=Math.round(correct/questions.length*100)/10;
 const map=new Map();questions.forEach((q,i)=>{const id=q.disciplinaId||'legado',g=map.get(id)||{id,nome:q.disciplinaNome||'Prova EJA',acertos:0,total:0};g.total++;if(answers[String(i)]===q.correta)g.acertos++;map.set(id,g);});
 const disciplinas=[...map.values()],zeradas=disciplinas.filter(g=>g.acertos===0).map(g=>g.nome);
 return {correct,total:questions.length,grade,approved:correct*2>=questions.length&&!zeradas.length,disciplinas,zeradas};
}
export function validAnswers(patch,questions){if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).length>questions.length)fail(400,'Respostas inválidas.');const out={};for(const [key,v]of Object.entries(patch)){if(!/^(0|[1-9]\d*)$/.test(key)||!questions[Number(key)]||!Number.isInteger(v)||v<0||v>=questions[Number(key)].opcoes.length)fail(400,'Alternativa inválida.');out[key]=v;}return out;}
export function publicAttempt(a){if(!a)return null;const {questions,...rest}=a;return {...rest,questions:(questions||[]).map(({correta,...q})=>q)};}

export const isSingleExam=c=>isEja(c)&&c?.ejaMode!=='modular';
