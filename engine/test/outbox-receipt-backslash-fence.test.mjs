import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture(result) {
  let acks=0, dispatches=0;
  const store={claimOutbox:async()=>lease,ackOutbox:async()=>{acks++;return true}};
  const relay={next:async()=>{dispatches++;return result}};
  return {store,relay,acks:()=>acks,dispatches:()=>dispatches};
}
const direct = url => ({state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:url});
for(const [name,url] of [
  ['authority backslash', 'https://runner.example\\@attacker.example/receipts/T1'],
  ['path backslash', 'https://runner.example\\receipts/T1'],
  ['embedded path backslash', 'https://runner.example/receipts\\T1']
]) test('rejects noncanonical '+name+' before durable ACK', async()=>{
  const f=fixture(direct(url));
  const r=await drainOne({...f,workerIds:['workerA','workerB']});
  assert.equal(r.state,'recovery_required');
  assert.equal(f.acks(),0);
  assert.equal(f.dispatches(),1);
});
test('rejects delegated replacement backslash without ACK',async()=>{
  const f=fixture({state:'delegated',worker:'workerA',replacement:{state:'dispatched',ticket:'T2',worker:'workerB',receipt_url:'https://runner.example\\@attacker.example/receipts/T2'}});
  const r=await drainOne({...f,workerIds:['workerA','workerB']});
  assert.equal(r.state,'recovery_required');
  assert.equal(f.acks(),0);
});
test('retains canonical HTTPS and percent-encoded paths',async()=>{
  for(const url of ['https://runner.example/receipts/T1','https://runner.example/receipts/T1%5C','https://runner.example/receipts/T1%0A']){
    const f=fixture(direct(url));
    const r=await drainOne({...f,workerIds:['workerA']});
    assert.equal(r.state,'acknowledged');
    assert.equal(f.acks(),1);
  }
});
