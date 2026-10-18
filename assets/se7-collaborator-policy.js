export function isProfessor(role){return !role||/^professor(a)?$/i.test(String(role).trim());}
export function isSecretary(role){return /^(secretaria|secretário|secretária|atendimento)$/i.test(String(role).trim());}
export function canonicalRole(role){if(isProfessor(role))return 'Professor';if(isSecretary(role))return 'Secretaria';if(/^(coordenação|coordenador|coordenadora)$/i.test(role))return 'Coordenação';if(['Limpeza','Financeiro'].includes(role))return role;throw Error('Escolha um cargo válido.');}

export function networkRole(role){return ['Coordenação','Financeiro'].includes(canonicalRole(role));}
export function singlePoloRole(role){return isSecretary(role)||canonicalRole(role)==='Limpeza';}
