import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture(result) {
  const calls=[];
  return {
    calls,
    store:{claimOutbox:async()=>lease,ackOutbox:async()=>{calls.push('ack');return true}},
    relay:{next:async worker=>{calls.push(worker);return result}}
  };
}
for (const suffix of ['%00','%0A','%0d','%1f','%7F']) {
  test(`percent-encoded control ${suffix} cannot authorize direct ACK`,async()=>{
    const f=fixture({state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:`https://runner.example/receipt/${suffix}`});
    assert.equal((await drainOne({...f,workerIds:['workerA','workerB']})).state,'recovery_required');
    assert.deepEqual(f.calls,['workerA']);
  });
}
test('percent-encoded CRLF in delegated replacement cannot authorize ACK',async()=>{
  const f=fixture({state:'delegated',worker:'workerA',replacement:{state:'dispatched',ticket:'T2',worker:'workerB',receipt_url:'https://runner.example/%0D%0A'}});
  assert.equal((await drainOne({...f,workerIds:['workerA','workerB']})).state,'recovery_required');
  assert.deepEqual(f.calls,['workerA']);
});
test('ordinary percent-encoded URL characters remain valid',async()=>{
  const f=fixture({state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:'https://runner.example/receipt/space%20ok%2Fnext'});
  assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'acknowledged');
  assert.deepEqual(f.calls,['workerA','ack']);
});
