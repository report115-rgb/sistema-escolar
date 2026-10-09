import {randomBytes,pbkdf2 as pbkdf2Callback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const pbkdf2=promisify(pbkdf2Callback);
export const roles=['secretaria','professor','financeiro','totem'];
export const tabs=['home','financeiro','notas','frequencia','documentos','calendario','carteirinha'];
export const docTypes=['rg_cnh','cpf','comprovante_residencia','certidao_nasc_cas','diploma_medio','historico_medio'];
export const digest=x=>createHash('sha256').update(String(x)).digest('hex');
export const cpfKey=x=>digest(String(x).replace(/\D/g,''));
export const studentUid=id=>'se7s_'+digest(id).slice(0,40);
export const alias=id=>studentUid(id)+'@alunos.se7.invalid';
export function validId(value) {if(typeof value!=='string'||!value||value.length>128||value.includes('/'))throw Object.assign(new Error('Identificador inválido.'),{status:400});return value;}
export function password(value){if(typeof value!=='string'||value.length<8||value.length>128)throw Object.assign(new Error('A senha deve ter de 8 a 128 caracteres.'),{status:400});return value;}
export async function hashPassword(value){const salt=randomBytes(16);return {algorithm:'PBKDF2-SHA256',iterations:210000,salt:salt.toString('hex'),hash:(await pbkdf2(value,salt,210000,32,'sha256')).toString('hex')};}
export async function verifyPassword(value,c){if(typeof value!=='string'||value.length>128||!c||c.algorithm!=='PBKDF2-SHA256'||c.iterations!==210000||!/^[a-f0-9]{32}$/.test(c.salt)||!/^[a-f0-9]{64}$/.test(c.hash))return false;return timingSafeEqual(await pbkdf2(value,Buffer.from(c.salt,'hex'),210000,32,'sha256'),Buffer.from(c.hash,'hex'));}
export function publicStudent(d){const {senhaAluno,portalCredential,pass,password,senha,...safe}=d;return safe;}
export function validCPF(v){const s=String(v||'').replace(/\D/g,'');if(s.length!==11||/^(\d)\1{10}$/.test(s))return false;for(let n=9;n<=10;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(s[i])*(n+1-i);let check=(sum*10)%11;if(check===10)check=0;if(check!==Number(s[n]))return false;}return true;}
