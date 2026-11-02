import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture(result) {
  let acks=0, invocations=0;
  return {
    store:{claimOutbox:async()=>lease,ackOutbox:async()=>{acks++;return true}},
    relay:{next:async()=>{invocations++;return result}},
    acks:()=>acks,invocations:()=>invocations
  };
}
const dispatched = url => ({state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:url});
for (const [label,url] of [
  ['encoded fragment','https://runner.example/receipts/T1%23hidden'],
  ['encoded query delimiter','https://runner.example/receipts/T1%3Fdebug=1'],
  ['twice-encoded fragment','https://runner.example/receipts/T1%2523hidden'],
  ['twice-encoded query delimiter','https://runner.example/receipts/T1%253Fdebug=1']
]) test('rejects '+label+' before durable ACK',async()=>{
  const f=fixture(dispatched(url));
  const result=await drainOne({...f,workerIds:['workerA','workerB']});
  assert.equal(result.state,'recovery_required');
  assert.equal(f.acks(),0);
  assert.equal(f.invocations(),1);
});
test('rejects delegated encoded fragment before ACK or alternate invocation',async()=>{
  const f=fixture({state:'delegated',worker:'workerA',replacement:{
    state:'dispatched',ticket:'T2',worker:'workerB',
    receipt_url:'https://runner.example/receipts/T2%2523hidden'
  }});
  const result=await drainOne({...f,workerIds:['workerA','workerB']});
  assert.equal(result.state,'recovery_required');
  assert.equal(f.acks(),0);
  assert.equal(f.invocations(),1);
});
test('preserves canonical HTTPS receipts with literal query or benign percent data',async()=>{
  for (const url of [
    'https://runner.example/receipts/T1',
    'https://runner.example/receipts/T1?attempt=1',
    'https://runner.example/receipts/T1%2Btag',
    'https://runner.example/receipts/T1%25tag'
  ]) {
    const f=fixture(dispatched(url));
    const result=await drainOne({...f,workerIds:['workerA']});
    assert.equal(result.state,'acknowledged',url);
    assert.equal(f.acks(),1,url);
  }
});
