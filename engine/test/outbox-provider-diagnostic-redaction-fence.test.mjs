import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
const SECRET='SYNTHETIC_PROVIDER_TOKEN_DO_NOT_LOG';
const store=()=>({claimOutbox:async()=>lease,ackOutbox:async()=>true});

test('relay transport exception does not put provider token into durable attempts',async()=>{
  const result=await drainOne({store:store(),workerIds:['workerA'],relay:{next:async()=>{
    throw new Error(`request failed: Bearer ${SECRET}`);
  }}});
  assert.equal(result.state,'recovery_required');
  assert.equal(result.attempts[0].state,'error');
  assert.equal(result.attempts[0].reason,'Error');
  assert.equal(JSON.stringify(result).includes(SECRET),false);
});

test('ACK exception does not put provider token into durable attempts',async()=>{
  const s=store();s.ackOutbox=async()=>{throw new TypeError(`bad authorization: ${SECRET}`)};
  const result=await drainOne({store:s,workerIds:['workerA'],relay:{next:async worker=>({state:'dispatched',ticket:'T1',worker,receipt_url:'https://runner.example/T1'})}});
  assert.equal(result.state,'recovery_required');
  assert.equal(result.reason,'outbox ack not confirmed');
  assert.equal(result.attempts[1].reason,'TypeError');
  assert.equal(JSON.stringify(result).includes(SECRET),false);
});

test('unrecognized provider status is not echoed into durable attempts',async()=>{
  const result=await drainOne({store:store(),workerIds:['workerA'],relay:{next:async()=>({state:SECRET})}});
  assert.equal(result.state,'recovery_required');
  assert.equal(result.attempts[0].state,'unknown');
  assert.equal(JSON.stringify(result).includes(SECRET),false);
});

test('ordinary known failed status remains visible and never acknowledges',async()=>{
  const result=await drainOne({store:store(),workerIds:['workerA'],relay:{next:async()=>({state:'failed'})}});
  assert.equal(result.state,'recovery_required');
  assert.equal(result.attempts[0].state,'failed');
});
