import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';
const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};

test('claim-time roster mutation cannot inject unqualified worker after validation',async()=>{
  const roster=['workerA'];
  const invoked=[];
  const store={claimOutbox:async()=>{roster.push('bad worker');return lease},ackOutbox:async()=>true,settleIdleOutbox:async()=>false};
  const relay={next:async w=>{invoked.push(w);return {state:'idle'}}};
  const result=await drainOne({store,relay,workerIds:roster});
  assert.equal(result.state,'recovery_required');
  assert.deepEqual(invoked,['workerA']);
});

test('worker callback cannot append a new eligible worker to validated roster',async()=>{
  const roster=['workerA'];
  const invoked=[];
  const store={claimOutbox:async()=>lease,ackOutbox:async()=>true,settleIdleOutbox:async()=>false};
  const relay={next:async w=>{invoked.push(w);if(w==='workerA')roster.push('workerB');return {state:'idle'}}};
  const result=await drainOne({store,relay,workerIds:roster});
  assert.equal(result.state,'recovery_required');
  assert.deepEqual(invoked,['workerA']);
});
