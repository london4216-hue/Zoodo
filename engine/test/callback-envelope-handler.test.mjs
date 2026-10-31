import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../ops/relay/portable-relay.mjs';

const secret='callback-secret-is-long-enough-123';
const auth={authorization:'Bearer '+secret};
function fixture(){
 let calls=0;
 const handler=makeHandler({callbackSecret:secret,relay:{
  next:async()=>{calls++;return {state:'idle'};},
  completed:async()=>{calls++;return {state:'completed'};},
  notStarted:async()=>{calls++;return {state:'requeued'};},
  replay:async()=>{calls++;return {state:'empty'};},
  reconcile:async()=>{calls++;return {state:'reconciled'};}
 }});
 return {handler,get calls(){return calls;}};
}

test('authenticated JSON scalar, null, array and missing-type callbacks are rejected before relay invocation',async()=>{
 const f=fixture();
 for(const body of ['null','true','1','[]','{}','{"type":false}','{"type":""}']){
  const response=await f.handler({method:'POST',headers:auth,body});
  assert.equal(response.statusCode,400,body);
  assert.equal(JSON.parse(response.body).error,'invalid callback envelope');
 }
 assert.equal(f.calls,0);
});
test('unauthenticated invalid envelope is rejected before parsing',async()=>{
 const f=fixture();
 const response=await f.handler({method:'POST',headers:{authorization:'Bearer wrong'},body:'null'});
 assert.equal(response.statusCode,401);
 assert.equal(f.calls,0);
});
test('valid authenticated kick remains dispatchable',async()=>{
 const f=fixture();
 const response=await f.handler({method:'POST',headers:auth,body:'{"type":"kick","worker":"w"}'});
 assert.equal(response.statusCode,200);
 assert.equal(f.calls,1);
});
