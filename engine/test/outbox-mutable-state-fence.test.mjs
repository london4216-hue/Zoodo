import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';
const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture(result) {
  const calls=[];
  return {calls,
    store:{claimOutbox:async()=>lease,ackOutbox:async()=>{calls.push('ack');return true;},settleIdleOutbox:async()=>{calls.push('settle');return false;}},
    relay:{next:async worker=>{calls.push(['next',worker]);return result;}}};
}
function changingState(first,rest) {
  let reads=0;
  const result={ticket:'T1',worker:'workerA',receipt_url:'https://runner.example/receipts/T1'};
  Object.defineProperty(result,'state',{get(){reads++;return reads===1?first:rest;}});
  return {result,reads:()=>reads};
}
test('mutable idle-to-dispatched getter cannot ACK contradictory evidence',async()=>{
  const s=changingState('idle','dispatched');const f=fixture(s.result);
  const r=await drainOne({...f,workerIds:['workerA']});
  assert.equal(r.state,'recovery_required');
  assert.equal(f.calls.includes('ack'),false);
  assert.equal(s.reads(),1,'relay state must be captured once');
});
test('mutable failed-to-dispatched getter cannot upgrade a failed dispatch to ACK',async()=>{
  const s=changingState('failed','dispatched');const f=fixture(s.result);
  const r=await drainOne({...f,workerIds:['workerA']});
  assert.equal(r.state,'recovery_required');
  assert.equal(f.calls.includes('ack'),false);
  assert.equal(s.reads(),1,'relay state must be captured once');
});
test('stable dispatched state still acknowledges authenticated receipt',async()=>{
  const s=changingState('dispatched','dispatched');const f=fixture(s.result);
  const r=await drainOne({...f,workerIds:['workerA']});
  assert.equal(r.state,'acknowledged');
  assert.equal(f.calls.includes('ack'),true);
  assert.equal(s.reads(),1,'even valid state must not be re-read');
});
