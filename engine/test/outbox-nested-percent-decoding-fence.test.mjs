import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
async function attempt(url,delegated=false) {
  const calls=[];
  const store={claimOutbox:async()=>{calls.push('claim');return lease},
    ackOutbox:async()=>{calls.push('ack');return true}};
  const relay={next:async worker=>{
    calls.push('next:'+worker);
    return delegated
      ? {state:'delegated',worker,replacement:{state:'dispatched',ticket:'T2',worker:'workerB',receipt_url:url}}
      : {state:'dispatched',ticket:'T1',worker,receipt_url:url};
  }};
  const result=await drainOne({store,relay,workerIds:delegated?['workerA','workerB']:['workerA']});
  return {result,calls};
}
for(const [name,url,delegated] of [
  ['nested CRLF','https://runner.example/r/%250D%250A',false],
  ['nested zero-width Unicode','https://runner.example/r/%25E2%2580%258B',false],
  ['delegated nested backslash','https://runner.example/r/%255C',true],
  ['triple-nested newline','https://runner.example/r/%25250A',false],
  ['sixfold-nested newline','https://runner.example/r/%2525252525250A',false]
]) {
  test(name+' cannot authorize durable ACK',async()=>{
    const {result,calls}=await attempt(url,delegated);
    assert.equal(result.state,'recovery_required');
    assert.deepEqual(calls,['claim','next:workerA']);
  });
}
for(const [name,url] of [
  ['literal percent','https://runner.example/r/100%25'],
  ['ordinary UTF-8','https://runner.example/r/caf%C3%A9'],
  ['nested safe slash','https://runner.example/r/a%252Fb']
]) {
  test(name+' remains a valid HTTPS receipt',async()=>{
    const {result,calls}=await attempt(url);
    assert.equal(result.state,'acknowledged');
    assert.deepEqual(calls,['claim','next:workerA','ack']);
  });
}
