import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture(receipt_url) {
  let acks = 0;
  let calls = 0;
  return {
    store: {claimOutbox:async()=>lease, ackOutbox:async()=>{acks++;return true}},
    relay: {next:async()=>{calls++;return {state:'dispatched',ticket:'T1',worker:'workerA',receipt_url}}},
    acks:()=>acks, calls:()=>calls
  };
}
for (const [name, url] of [
  ['raw space in path','https://runner.example/receipts/T 1'],
  ['raw nonbreaking space in path','https://runner.example/receipts/T\u00a01'],
  ['raw ideographic space in path','https://runner.example/receipts/T\u30001']
]) test('rejects '+name+' before durable ACK',async()=>{
  const f=fixture(url);
  const r=await drainOne({...f,workerIds:['workerA','workerB']});
  assert.equal(r.state,'recovery_required');
  assert.equal(f.acks(),0);
  assert.equal(f.calls(),1);
});
test('accepts percent-encoded spaces in canonical HTTPS receipts',async()=>{
  const f=fixture('https://runner.example/receipts/T%201');
  const r=await drainOne({...f,workerIds:['workerA']});
  assert.equal(r.state,'acknowledged');
  assert.equal(f.acks(),1);
});
