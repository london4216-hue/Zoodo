import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';
const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture(result, event=lease) {
 const calls=[];
 return {calls,store:{claimOutbox:async()=>{calls.push('claim');return event},ackOutbox:async()=>{calls.push('ack');return true}},relay:{next:async()=>{calls.push('next');return result}}};
}
test('non-string dispatch ticket must not ACK outbox',async()=>{
 const f=fixture({state:'dispatched',ticket:123,worker:'workerA',receipt_url:'https://runner.example/123'});
 assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'recovery_required');
 assert.deepEqual(f.calls,['claim','next']);
});
test('non-string outbox ticket must be rejected before worker invocation',async()=>{
 const f=fixture({state:'idle'},{...lease,ticket_id:123});
 await assert.rejects(drainOne({...f,workerIds:['workerA']}),/Invalid durable outbox lease/);
 assert.deepEqual(f.calls,['claim']);
});
test('non-string delegated replacement worker must not ACK outbox',async()=>{
 const f=fixture({state:'delegated',worker:'workerA',replacement:{state:'dispatched',ticket:'T2',worker:123,receipt_url:'https://runner.example/T2'}});
 assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'recovery_required');
 assert.deepEqual(f.calls,['claim','next']);
});
