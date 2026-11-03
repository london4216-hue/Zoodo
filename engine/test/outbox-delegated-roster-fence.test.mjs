import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';
const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
const delegated={state:'delegated',worker:'workerA',replacement:{state:'dispatched',ticket:'T2',worker:'workerB',receipt_url:'https://runner.example/T2'}};
function fixture(){const calls=[];return {calls,store:{claimOutbox:async()=>lease,ackOutbox:async()=>{calls.push('ack');return true}},relay:{next:async()=>delegated}};}
test('unlisted delegated worker cannot cause durable ACK',async()=>{
 const f=fixture();const result=await drainOne({...f,workerIds:['workerA']});
 assert.equal(result.state,'recovery_required');
 assert.deepEqual(f.calls,[]);
});
test('listed delegated worker with complete receipt can ACK',async()=>{
 const f=fixture();const result=await drainOne({...f,workerIds:['workerA','workerB']});
 assert.equal(result.state,'acknowledged');
 assert.deepEqual(f.calls,['ack']);
});
