import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';
const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture(result){let acks=0;const store={claimOutbox:async()=>lease,ackOutbox:async()=>{acks++;return true}};
 const relay={next:async()=>result};return {store,relay,ackCount:()=>acks};}
for(const [name,url] of [
 ['trailing newline','https://runner.example/receipts/T1\n'],
 ['leading tab and space',' \thttps://runner.example/receipts/T1'],
 ['embedded newline','https://runner.example/recei\npts/T1'],
 ['bidirectional format marker','https://runner.example/receipts/T1\u202e']
]) test('direct dispatch rejects '+name,async()=>{
 const f=fixture({state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:url});
 const r=await drainOne({...f,workerIds:['workerA']});
 assert.equal(r.state,'recovery_required');assert.equal(f.ackCount(),0);
});
test('delegated replacement rejects raw newline in receipt URL',async()=>{
 const f=fixture({state:'delegated',worker:'workerA',replacement:{state:'dispatched',ticket:'T2',worker:'workerB',receipt_url:'https://runner.example/receipts/T2\n'}});
 const r=await drainOne({...f,workerIds:['workerA','workerB']});
 assert.equal(r.state,'recovery_required');assert.equal(f.ackCount(),0);
});
test('normal HTTPS receipt and percent-encoded newline remain valid',async()=>{
 for(const url of ['https://runner.example/receipts/T1','https://runner.example/receipts/T1%0A']){
  const f=fixture({state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:url});
  assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'acknowledged');
  assert.equal(f.ackCount(),1);
 }
});
