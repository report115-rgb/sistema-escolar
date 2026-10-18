import {compensationAt,numericMoney} from '../assets/se7-remuneration-policy.js';
const fail=(s,m)=>{throw Object.assign(Error(m),{status:s});};
export function remunerationChange(b,old,teacher,u){
 if(!Object.hasOwn(b,'compensation'))return null;
 const c=b.compensation;if(!c||!/^\d{4}-(0[1-9]|1[0-2])$/.test(c.from||'')||c.from<'2000-01'||c.from>'2199-12'||!Number.isSafeInteger(c.amountCents)||c.amountCents<=0||c.amountCents>10000000000||!Number.isInteger(c.dueDay)||c.dueDay<1||c.dueDay>31)fail(400,'Confira valor, competência e dia de vencimento da remuneração.');
 const history=[...(old.compensationHistory||[])],value={kind:teacher?'hourly':'salary',amountCents:c.amountCents,from:c.from,dueDay:c.dueDay};
 const prev=history.find(x=>x.from===c.from);if(prev&&prev.kind===value.kind&&prev.amountCents===value.amountCents&&prev.dueDay===value.dueDay)return null;
 if(history.some(x=>x.from>=c.from))fail(409,'Para alterar a remuneração, escolha uma competência posterior à última configuração. O histórico será preservado.');
 if(history.length>=120)fail(409,'Histórico de remuneração extenso. Solicite conferência.');
 return {...value,at:new Date().toISOString(),by:u.uid};
}
export async function readSalarySetup(tx,db,id,change,old){
 const [plans,paid,rows,legacy]=await Promise.all([tx.get(db.collection('se7ExpensePlans').where('employeeId','==',id)),tx.get(db.collection('teacherMonthlyPayments').where('professorId','==',id)),tx.get(db.collection('se7ExpenseRows').where('employeeId','==',id)),tx.get(db.collection('teacherPaymentRates').doc(id))]);
 if(change){const recorded=[...paid.docs.map(d=>({month:d.data().competencia,...d.data()})),...rows.docs.map(d=>d.data())];if(recorded.some(p=>(p.month||'')>=change.from&&(p.status==='paid'||p.status==='pago'||p.paidCents!==undefined||p.valorPagoCentavos!==undefined)))fail(409,'Há pagamento registrado a partir desta competência. Escolha uma competência posterior ao último pagamento.');}
 const available=plans.docs.filter(d=>!d.data().deletedAt);if(change?.kind==='salary'&&available.length>1)fail(409,'Há mais de uma conta salarial cadastrada. Confira as recorrências no Financeiro antes de configurar a remuneração.');
 const existing=available[0];if(change?.kind==='salary'&&existing&&(existing.data().recurrence!=='monthly'||existing.data().amountMode!=='fixed'||existing.data().endMonth))fail(409,'A conta salarial existente precisa ser conferida: utilize uma recorrência mensal fixa sem encerramento para vinculá-la.');
 return {plans:available,legacy:legacy.data()||{},plan:existing?{id:existing.id,...existing.data()}:null};
}
export function writeSalarySetup(tx,db,id,t,old,change,setup){
 if(!change)return;
 const history=[...(old.compensationHistory||[])];
 // Import the existing hourly rate as the historical fallback, never replace its previous competences.
 if(!history.length&&change.kind==='hourly'){const amount=numericMoney(setup.legacy.valorHora??old.valorHora??old.valorHoraAula??0);if(Number.isFinite(amount)&&amount>0)history.push({from:'2000-01',kind:'hourly',amountCents:Math.round(amount*100),dueDay:10,legacy:true});}
 history.push(change);tx.update(db.collection('teachers').doc(id),{compensationHistory:history});
 if(change.kind!=='salary')return;
 const p=setup.plan,pid=p?.id||'salary_'+id,oldSchedule=p?.salarySchedule||[];
 if(p&&!oldSchedule.length&&p.startMonth<change.from)oldSchedule.push({from:p.startMonth,amountCents:p.amountCents,dueDay:p.dueDay});
 const schedule=[...oldSchedule,change].sort((a,b)=>a.from.localeCompare(b.from));
 tx.set(db.collection('se7ExpensePlans').doc(pid),{...(p||{}),id:pid,title:'Salário',category:'Colaboradores',recurrence:'monthly',amountMode:'fixed',amountCents:change.amountCents,startMonth:p?.startMonth&&p.startMonth<change.from?p.startMonth:change.from,dueDay:change.dueDay,employeeId:id,employeeName:t.fullname,poloId:t.poloId||'',endMonth:'',salaryManaged:true,salarySchedule:schedule,createdAt:p?.createdAt||change.at,createdBy:p?.createdBy||{uid:change.by},updatedAt:change.at});
}
export function salaryPlanAt(p,month){const c=[...(p.salarySchedule||[])].filter(c=>c.from<=month).sort((a,b)=>b.from.localeCompare(a.from))[0];return c?{...p,amountCents:c.amountCents,dueDay:c.dueDay}:p;}
