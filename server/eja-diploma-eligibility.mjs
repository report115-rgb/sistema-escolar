// Verificação pura e conservadora das três condições de diploma EJA.
// O chamador deve obter os estados oficiais do financeiro, da avaliação e da documentação.
export function ejaDiplomaEligibility({finance,academic,documents}={}){
 const financeOk=finance?.complete===true&&finance?.allPaid===true&&finance?.pendingCount===0;
 const academicOk=academic?.complete===true&&academic?.allApproved===true&&academic?.pendingCount===0;
 const documentsOk=documents?.complete===true&&documents?.allApproved===true&&documents?.pendingCount===0;
 return {eligible:financeOk&&academicOk&&documentsOk,checks:{finance:financeOk,academic:academicOk,documents:documentsOk}};
}
