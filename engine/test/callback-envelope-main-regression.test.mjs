import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../ops/relay/portable-relay.mjs';

const SECRET='zoo-callback-regression-secret-20261031';
function fixture() {
 const calls=[];
 const relay={
  next:async worker=>{calls.push(['next',worker]);return {state:'idle'};},
  completed:async x=>{calls.push(['completed',x]);return {state:'completed'};},
  notStarted:async x=>{calls.push(['notStarted',x]);return {state:'requeued'};},
  quarantine:async()=>{calls.push(['quarantine']);return 0;}
 };
 const h=makeHandler({relay,callbackSecret:SECRET});
 const send=(body,auth='Bearer '+SECRET)=>h({method:'POST',headers:{authorization:auth},body});
 return {send,calls};
}
test('authenticated malformed JSON envelopes never dispatch',async()=>{
 const {send,calls}=fixture();
 for(const body of ['null','[]','true','0','"kick"','{}','{"type":0}','{"type":""}','{"type":"   "}']) {
  const result=await send(body);
  assert.equal(result.statusCode,400,'body '+body);
  assert.equal(JSON.parse(result.body).error,'invalid callback envelope');
 }
 assert.equal(calls.length,0);
});
test('authentication and size gates precede envelope decoding',async()=>{
 const {send,calls}=fixture();
 assert.equal((await send('null','Bearer invalid')).statusCode,401);
 assert.equal((await send('x'.repeat(8193))).statusCode,413);
 assert.equal((await send('{')).statusCode,400);
 assert.equal(calls.length,0);
});
test('valid kick still dispatches exactly once',async()=>{
 const {send,calls}=fixture();
 assert.equal((await send('{"type":"kick","worker":"worker-a"}')).statusCode,200);
 assert.deepEqual(calls,[['next','worker-a']]);
});
