import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
async function run(receipt, workerIds=['workerA']) {
  let acks=0;
  const store={claimOutbox:async()=>lease,ackOutbox:async()=>{acks++;return true}};
  const relay={next:async()=>receipt};
  const result=await drainOne({store,relay,workerIds});
  return {result,acks};
}
function direct(url) {
  return {state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:url};
}
for (const [name,url] of [
  ['lone high surrogate','https://runner.example/r/\uD800'],
  ['lone low surrogate','https://runner.example/r/\uDC00']
]) test('reject direct dispatch receipt containing '+name,async()=>{
  const {result,acks}=await run(direct(url));
  assert.equal(result.state,'recovery_required');
  assert.equal(acks,0);
});
test('reject delegated receipt with lone surrogate before durable ACK',async()=>{
  const {result,acks}=await run({state:'delegated',worker:'workerA',replacement:{state:'dispatched',ticket:'T2',worker:'workerB',receipt_url:'https://runner.example/r/\uD800'}},['workerA','workerB']);
  assert.equal(result.state,'recovery_required');
  assert.equal(acks,0);
});
for (const [name,url] of [
  ['ordinary HTTPS','https://runner.example/r/T1'],
  ['valid supplementary Unicode','https://runner.example/r/😀'],
  ['percent-encoded Unicode','https://runner.example/r/%F0%9F%98%80']
]) test('preserve valid '+name+' receipt',async()=>{
  const {result,acks}=await run(direct(url));
  assert.equal(result.state,'acknowledged');
  assert.equal(acks,1);
});
