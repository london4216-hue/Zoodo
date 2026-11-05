import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
async function runWithState(state) {
  let ackCalls = 0;
  const store = {
    claimOutbox: async () => lease,
    ackOutbox: async () => {ackCalls++; return true;}
  };
  const relay = {next: async () => ({state})};
  const result = await drainOne({store,relay,workerIds:['workerA']});
  return {result,ackCalls};
}

test('cyclic non-string worker state remains serializable recovery evidence, never ACK',async()=>{
  const cyclic = {}; cyclic.self = cyclic;
  const {result,ackCalls} = await runWithState(cyclic);
  assert.equal(result.state,'recovery_required');
  assert.equal(result.attempts[0].state,'unknown');
  assert.doesNotThrow(()=>JSON.stringify(result));
  assert.equal(ackCalls,0);
});

test('oversized worker state cannot inflate durable recovery receipt',async()=>{
  const {result,ackCalls} = await runWithState('x'.repeat(1000000));
  assert.equal(result.state,'recovery_required');
  assert.equal(result.attempts[0].state,'unknown');
  assert.ok(JSON.stringify(result).length < 1000);
  assert.equal(ackCalls,0);
});
