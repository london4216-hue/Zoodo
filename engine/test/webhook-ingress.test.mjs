import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';
import {verifySignature,ingestIssue,createIngressServer} from '../src/webhook-ingress.mjs';
const secret='a-test-webhook-secret-of-adequate-length';
const payload={action:'labeled',label:{name:'zoo-ready'},sender:{login:'london4216-hue'},repository:{full_name:'london4216-hue/Zoodo'},issue:{number:12,title:'Build evidence clock',body:'## Acceptance\\nMust fail closed and pass exact-head tests\\n'}};
const options={repos:['london4216-hue/Zoodo'],maintainers:['london4216-hue']};
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'zoo-ingress-')),file=join(dir,'queue.jsonl'),q=new DurableQueue(file,{leaseMs:100,maxAttempts:3});return Promise.resolve().then(()=>fn(q,file)).finally(()=>rmSync(dir,{recursive:true,force:true}))}
const sig=raw=>'sha256='+createHmac('sha256',secret).update(raw).digest('hex');
test('signature valid, tampered body rejected',()=>{const raw=Buffer.from(JSON.stringify(payload));assert.equal(verifySignature(raw,sig(raw),secret),true);assert.equal(verifySignature(Buffer.from('tamper'),sig(raw),secret),false);assert.equal(verifySignature(raw,'sha256=bad',secret),false)});
test('event creates durable idempotent ticket and duplicate does not multiply',()=>fixture((q,file)=>{assert.equal(ingestIssue(q,payload,options).created,true);assert.equal(ingestIssue(q,payload,options).created,false);assert.equal(new DurableQueue(file).list().length,1)}));
test('wrong repo or untrusted labeler denied',()=>fixture(q=>{assert.equal(ingestIssue(q,{...payload,sender:{login:'stranger'}},options).accepted,false);assert.equal(ingestIssue(q,{...payload,repository:{full_name:'other/private'}},options).accepted,false);assert.equal(q.list().length,0)}));
test('no acceptance criteria or wrong event cannot create ticket',()=>fixture(q=>{assert.equal(ingestIssue(q,{...payload,issue:{...payload.issue,body:'no acceptance'}},options).accepted,false);assert.equal(ingestIssue(q,{...payload,action:'opened'},options).accepted,false);assert.equal(q.list().length,0)}));
test('actual HTTP webhook produces queued ticket; invalid signature rejected',()=>fixture(async q=>{const server=createIngressServer({queue:q,secret,...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const url='http://127.0.0.1:'+server.address().port+'/github',raw=JSON.stringify(payload),headers={'x-github-event':'issues','x-hub-signature-256':sig(Buffer.from(raw))};let response=await fetch(url,{method:'POST',headers,body:raw});assert.equal(response.status,202);assert.equal((await response.json()).created,true);response=await fetch(url,{method:'POST',headers:{...headers,'x-hub-signature-256':'sha256='+'0'.repeat(64)},body:raw});assert.equal(response.status,401);assert.equal(q.list().length,1)}finally{await new Promise(r=>server.close(r))}}));
