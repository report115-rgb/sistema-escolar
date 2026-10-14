import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('APIs carregam quando o runtime não permite require de módulos ESM',()=>{
 const result=spawnSync(process.execPath,['--no-experimental-require-module','--input-type=module','-e',"await import('./api/se7.js'); await import('./api/asaas-webhook.js'); await import('./api/whatsapp-webhook.js');"],{cwd:process.cwd(),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});

test('biblioteca de chaves preserva leitura de chave pública RSA',async()=>{
 const {createRequire}=await import('node:module');
 const require=createRequire(import.meta.url);
 const {generateKeyPairSync}=await import('node:crypto');
 const {publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const jwk={...publicKey.export({format:'jwk'}),kid:'regression-key',alg:'RS256',use:'sig'};
 const utils=require('jwks-rsa/src/utils.js');
 const keys=await utils.retrieveSigningKeys([jwk]);
 assert.equal(keys.length,1);
 assert.equal(keys[0].kid,'regression-key');
 assert.equal(keys[0].getPublicKey(),publicKey.export({format:'pem',type:'spki'}));
});
