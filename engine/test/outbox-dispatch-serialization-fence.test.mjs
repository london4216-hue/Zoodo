import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
async function run(result, workerIds=['workerA']) {
  let ackCalls=0;
  const store={claimOutbox:async()=>lease,ackOutbox:async()=>{ackCalls++;return true}};
  const relay={next:async()=>result};
  const outcome=await drainOne({store,relay,workerIds});
  return {outcome,ackCalls};
}

test('acknowledged direct dispatch excludes cyclic untrusted metadata from serializable evidence',async()=>{
  const result={state:'dispatched',ticket:'T2',worker:'workerA',receipt_url:'https://runner.example/T2'};
  result.metadata={self:result};
  const {outcome,ackCalls}=await run(result);
  assert.equal(outcome.state,'acknowledged');
  assert.equal(ackCalls,1);
  assert.doesNotThrow(()=>JSON.stringify(outcome));
  assert.deepEqual(outcome.dispatch,{state:'dispatched',ticket:'T2',worker:'workerA',receipt_url:'https://runner.example/T2'});
});

test('acknowledged delegated dispatch excludes cyclic replacement metadata',async()=>{
  const replacement={state:'dispatched',ticket:'T2',worker:'workerB',receipt_url:'https://runner.example/T2'};
  replacement.extra={back:replacement};
  const {outcome,ackCalls}=await run({state:'delegated',worker:'workerA',replacement},['workerA','workerB']);
  assert.equal(outcome.state,'acknowledged');
  assert.equal(ackCalls,1);
  assert.doesNotThrow(()=>JSON.stringify(outcome));
  assert.deepEqual(outcome.dispatch,{state:'delegated',worker:'workerA',replacement:{state:'dispatched',ticket:'T2',worker:'workerB',receipt_url:'https://runner.example/T2'}});
});

test('oversized receipt URL cannot trigger durable ACK or unbounded evidence',async()=>{
  const {outcome,ackCalls}=await run({state:'dispatched',ticket:'T2',worker:'workerA',receipt_url:'https://runner.example/'+ 'a'.repeat(100000)});
  assert.equal(outcome.state,'recovery_required');
  assert.equal(ackCalls,0);
  assert.ok(JSON.stringify(outcome).length<1000);
});
