import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture() {
  let claims = 0;
  let dispatches = 0;
  return {
    store: {claimOutbox:async()=>{claims++;return lease;},ackOutbox:async()=>true},
    relay: {next:async worker=>{dispatches++;return {state:'dispatched',ticket:'T1',worker,receipt_url:'https://runner.example/T1'};}},
    counts:()=>({claims,dispatches})
  };
}

test('oversized roster is rejected before durable claim or worker invocation',async()=>{
  const f=fixture();
  const workers=Array.from({length:257},(_,i)=>`worker${i}`);
  await assert.rejects(drainOne({...f,workerIds:workers}),/Qualified worker roster/);
  assert.deepEqual(f.counts(),{claims:0,dispatches:0});
});

test('bounded 256-worker roster still dispatches a confirmed worker',async()=>{
  const f=fixture();
  const workers=Array.from({length:256},(_,i)=>`worker${i}`);
  const result=await drainOne({...f,workerIds:workers});
  assert.equal(result.state,'acknowledged');
  assert.deepEqual(f.counts(),{claims:1,dispatches:1});
});
