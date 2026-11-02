import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
const receipt = {state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:'https://runner.example/receipt/T1'};
function blockPastDeadline() {
  const until = performance.now() + 55;
  while (performance.now() < until) {}
}
const base = () => ({claimOutbox:async()=>lease,ackOutbox:async()=>true,settleIdleOutbox:async()=>true});

test('synchronous ACK completing after deadline cannot report acknowledged', async () => {
  let ackCalls=0; const store=base();
  store.ackOutbox=()=>{ackCalls++;blockPastDeadline();return true;};
  const result=await drainOne({store,relay:{next:async()=>receipt},workerIds:['workerA','workerB'],operationTimeoutMs:12});
  assert.equal(result.state,'recovery_required');
  assert.equal(ackCalls,1);
  assert.deepEqual(result.attempts.map(a=>a.worker),['workerA','workerA']);
});

test('synchronous idle settlement completing after deadline cannot report settled', async () => {
  const store=base();let settleCalls=0;let workerCalls=0;
  store.settleIdleOutbox=()=>{settleCalls++;blockPastDeadline();return true;};
  const result=await drainOne({store,relay:{next:async()=>{workerCalls++;return {state:'idle'};}},workerIds:['workerA','workerB'],operationTimeoutMs:12});
  assert.equal(result.state,'recovery_required');
  assert.equal(settleCalls,1);
  assert.equal(workerCalls,1);
});

test('synchronous claim completing after deadline rejects without dispatch', async () => {
  const store=base();let workerCalls=0;
  store.claimOutbox=()=>{blockPastDeadline();return lease;};
  await assert.rejects(drainOne({store,relay:{next:async()=>{workerCalls++;return receipt;}},workerIds:['workerA'],operationTimeoutMs:12}),/deadline exceeded/);
  assert.equal(workerCalls,0);
});

test('fast legitimate ACK remains acknowledged', async () => {
  const result=await drainOne({store:base(),relay:{next:async()=>receipt},workerIds:['workerA'],operationTimeoutMs:1000});
  assert.equal(result.state,'acknowledged');
});
