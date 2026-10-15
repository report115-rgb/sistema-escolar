/* Origem nativa: somente operações do leitor e sempre com sessão autenticada. */
export const scannerOrigin='https://localhost';
export const scannerActions=new Set(['session','exam-scan-start','exam-scan-preview','exam-scan-review','exam-scan-commit','exam-scan-status','email-send']);
export function scannerCors(req,res){const origin=req.headers.origin;if(origin!==scannerOrigin)return false;res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Origin',scannerOrigin);res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Max-Age','600');return true;}
export function nativeRequestAllowed(req,b){if(req.headers.origin!==scannerOrigin)return true;return scannerActions.has(b.action)&&/^Bearer [^\s]+$/.test(req.headers.authorization||'');}
