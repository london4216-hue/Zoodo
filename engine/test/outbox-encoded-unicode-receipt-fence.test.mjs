import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:17,ticket_id:'ZOO-17',lease_token:'12345678-1234-4234-8234-123456789012'};
async function attempt(url,{delegated=false}={}) {
  const calls=[];
  const store={
    claimOutbox:async()=>{calls.push('claim');return lease},
    ackOutbox:async()=>{calls.push('ack');return true}
  };
  const relay={next:async(worker)=>{
    calls.push('next:'+worker);
    if (delegated) return {state:'delegated',worker,replacement:{state:'dispatched',ticket:'ZOO-17',worker:'workerB',receipt_url:url}};
    return {state:'dispatched',ticket:'ZOO-17',worker,receipt_url:url};
  }};
  const result=await drainOne({store,relay,workerIds:delegated?['workerA','workerB']:['workerA']});
  return {result,calls};
}

for(const [name,url] of [
  ['percent-encoded zero-width format character','https://runner.example/receipts/%E2%80%8B17'],
  ['percent-encoded nonbreaking space','https://runner.example/receipts/%C2%A017'],
  ['percent-encoded backslash','https://runner.example/receipts/%5C17'],
  ['percent-encoded ASCII space','https://runner.example/receipts/%2017'],
  ['invalid percent-encoded UTF-8','https://runner.example/receipts/%E2%80']
]){
  test(`direct receipt rejects ${name} without ACK`,async()=>{
    const {result,calls}=await attempt(url);
    assert.equal(result.state,'recovery_required');
    assert.deepEqual(calls,['claim','next:workerA']);
  });
}

test('delegated receipt rejects encoded Unicode format character without ACK or second invocation',async()=>{
  const {result,calls}=await attempt('https://runner.example/r/%E2%80%8B',{delegated:true});
  assert.equal(result.state,'recovery_required');
  assert.deepEqual(calls,['claim','next:workerA']);
});

test('ordinary percent-encoded path components remain valid',async()=>{
  for(const url of ['https://runner.example/receipts/caf%C3%A9','https://runner.example/receipts/a%2Fb','https://runner.example/receipts/100%25']){
    const {result,calls}=await attempt(url);
    assert.equal(result.state,'acknowledged',url);
    assert.deepEqual(calls,['claim','next:workerA','ack']);
  }
});
