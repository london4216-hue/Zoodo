import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOutboxHttpHandler} from '../ops/relay/outbox-http.mjs';
const secret='bounded-synthetic-secret-123456789';
const call=(handler,body,auth=secret,method='POST')=>handler({method,headers:{authorization:'Bearer '+auth},body});
test('fails closed without secret or callable drain',()=>{
 assert.throws(()=>makeOutboxHttpHandler({callbackSecret:'short',drain:async()=>({state:'empty'})}));
 assert.throws(()=>makeOutboxHttpHandler({callbackSecret:secret}));
});
test('does not invoke on unauthenticated request',async()=>{
 let calls=0;const h=makeOutboxHttpHandler({callbackSecret:secret,drain:async()=>{calls++;return {state:'empty'}}});
 assert.equal((await call(h,'{"type":"drain"}','wrong')).statusCode,401);
 assert.equal((await h({method:'POST',headers:{},body:'{"type":"drain"}'})).statusCode,401);
 assert.equal(calls,0);
});
test('rejects methods other than POST without execution',async()=>{
 let calls=0;const h=makeOutboxHttpHandler({callbackSecret:secret,drain:async()=>{calls++}});
 assert.equal((await call(h,'{"type":"drain"}',secret,'GET')).statusCode,405);
 assert.equal(calls,0);
});
test('rejects malformed, oversized, null, array, and unknown envelopes',async()=>{
 let calls=0;const h=makeOutboxHttpHandler({callbackSecret:secret,drain:async()=>{calls++}});
 for(const body of ['{','null','[]','{}','{"type":"kick"}','{"type":"drain","extra":1}'])
  assert.equal((await call(h,body)).statusCode,400,body);
 assert.equal((await call(h,'x'.repeat(1025))).statusCode,413);
 assert.equal(calls,0);
});
test('valid authenticated drain runs exactly once and returns bounded native result unchanged',async()=>{
 let calls=0;const h=makeOutboxHttpHandler({callbackSecret:secret,drain:async()=>{calls++;return {state:'acknowledged',eventId:9}}});
 const r=await call(h,'{"type":"drain"}');
 assert.equal(r.statusCode,200);assert.deepEqual(JSON.parse(r.body),{state:'acknowledged',eventId:9});
 assert.equal(r.headers['cache-control'],'no-store');assert.equal(calls,1);
});
test('runtime errors and invalid drain result are not reported as success',async()=>{
 for(const drain of [async()=>{throw Error('secret token must not leak')},async()=>null,async()=>({state:'recovery_required',eventId:4})]){
  const r=await call(makeOutboxHttpHandler({callbackSecret:secret,drain}),'{"type":"drain"}');
  assert.equal(r.statusCode,503);assert.ok(!r.body.includes('secret token'));
 }
});
