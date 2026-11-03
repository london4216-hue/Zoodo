import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
async function probe(receipt_url) {
  let acknowledgments = 0;
  const store = {
    claimOutbox:async()=>lease,
    ackOutbox:async()=>{acknowledgments++;return true}
  };
  const relay = {next:async()=>({
    state:'dispatched',ticket:'T1',worker:'workerA',receipt_url
  })};
  const result = await drainOne({store,relay,workerIds:['workerA']});
  return {result,acknowledgments};
}

for (const url of [
  'https:/runner.example/receipts/T1',
  'https:////runner.example/receipts/T1',
  'https://runner.example/a/../T2',
  'https://runner.example/a/%2e%2e/T2',
  'https://runner.example/a/%252e%252e/T2'
]) {
  test('noncanonical receipt path cannot authorize ACK: '+url,async()=>{
    const {result,acknowledgments}=await probe(url);
    assert.equal(result.state,'recovery_required');
    assert.equal(acknowledgments,0);
  });
}

for (const url of [
  'https://runner.example/receipts/T1',
  'https://runner.example/a/b?next=../T2',
  'https://runner.example/a/%2eT1'
]) {
  test('canonical receipt path preserves ACK: '+url,async()=>{
    const {result,acknowledgments}=await probe(url);
    assert.equal(result.state,'acknowledged');
    assert.equal(acknowledgments,1);
  });
}
