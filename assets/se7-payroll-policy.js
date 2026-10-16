export const PAYROLL_EDIT_MS=12*60*60*1000;
export function payrollDeadline(payment){const created=Date.parse(payment?.createdAt||'');return Number.isFinite(created)?created+PAYROLL_EDIT_MS:null;}
export function payrollEditable(payment,now=Date.now()){if(!payment)return true;const deadline=payrollDeadline(payment);return deadline!==null&&now>=deadline-PAYROLL_EDIT_MS&&now<deadline;}
export function assertPayrollEditable(payment,now=Date.now()){if(!payrollEditable(payment,now))throw Object.assign(Error('O prazo de 12 horas terminou. Este pagamento está disponível somente para consulta.'),{status:403});}
