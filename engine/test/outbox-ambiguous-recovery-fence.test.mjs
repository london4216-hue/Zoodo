import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';
const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
for(const state of ['recovery_required','failed','not_started','unexpected']) {
 test(`ambiguous ${state} result never dispatches second worker`,async()=>{
  const calls=[];
  const store={claimOutbox:async()=>lease,ackOutbox:async()=>{calls.push('ack');return true},settleIdleOutbox:async()=>false};
  const relay={next:async worker=>{calls.push(worker);return worker==='workerA'?{state,ticket:'T1'}:{state:'dispatched',ticket:'T2',worker,receipt_url:'https://runner.example/T2'}}};
  const result=await drainOne({store,relay,workerIds:['workerA','workerB']});
  assert.equal(result.state,'recovery_required');
  assert.deepEqual(calls,['workerA']);
 });
}
test('confirmed idle can still try another worker after failed durable empty-queue settlement',async()=>{
 const calls=[];
 const store={claimOutbox:async()=>lease,ackOutbox:async()=>true,settleIdleOutbox:async()=>false};
 const relay={next:async worker=>{calls.push(worker);return worker==='workerA'?{state:'idle'}:{state:'dispatched',ticket:'T2',worker,receipt_url:'https://runner.example/T2'}}};
 const result=await drainOne({store,relay,workerIds:['workerA','workerB']});
 assert.equal(result.state,'acknowledged');
 assert.deepEqual(calls,['workerA','workerB']);
});
