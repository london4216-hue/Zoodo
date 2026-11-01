import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};

test('duplicate worker roster is rejected before claiming a durable outbox wake-up',async()=>{
 const calls=[];
 const store={claimOutbox:async()=>{calls.push('claim');return lease},ackOutbox:async()=>true,settleIdleOutbox:async()=>false};
 const relay={next:async worker=>{calls.push(worker);return {state:'idle'}}};
 await assert.rejects(drainOne({store,relay,workerIds:['workerA','workerA']}),/Qualified worker roster/);
 assert.deepEqual(calls,[],'invalid roster must not claim or invoke');
});

test('distinct qualified worker roster still attempts a real alternate after idle',async()=>{
 const calls=[];
 const store={claimOutbox:async()=>lease,ackOutbox:async()=>true,settleIdleOutbox:async()=>false};
 const relay={next:async worker=>{calls.push(worker);return worker==='workerA'?{state:'idle'}:{state:'dispatched',ticket:'T2',worker,receipt_url:'https://runner.example/T2'}}};
 const result=await drainOne({store,relay,workerIds:['workerA','workerB']});
 assert.equal(result.state,'acknowledged');
 assert.deepEqual(calls,['workerA','workerB']);
});
