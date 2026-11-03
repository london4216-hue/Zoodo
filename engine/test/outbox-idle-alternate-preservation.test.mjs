import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
test('failed idle settlement preserves bounded qualified alternate dispatch',async()=>{
  const calls=[];
  const store={claimOutbox:async()=>lease,settleIdleOutbox:async()=>{calls.push('settle');return false},ackOutbox:async()=>{calls.push('ack');return true}};
  const relay={next:async worker=>{calls.push(worker);return worker==='workerA'?{state:'idle'}:{state:'dispatched',ticket:'T2',worker,receipt_url:'https://runner.example/receipts/T2'}}};
  const result=await drainOne({store,relay,workerIds:['workerA','workerB']});
  assert.equal(result.state,'acknowledged');
  assert.deepEqual(result.attempts,[{worker:'workerA',state:'idle'},{worker:'workerB',state:'dispatched'}]);
  assert.deepEqual(calls,['workerA','settle','workerB','ack']);
});
