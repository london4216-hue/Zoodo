import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {makeOutboxReplay} from '../ops/relay/outbox-replay.mjs';

const event = {id:1,ticket_id:'T1',lease_token:'11111111-1111-4111-8111-111111111111'};
const hang = () => new Promise(() => {});
const bounded = async (fn) => {
  const started = performance.now();
  const result = await Promise.race([fn(),new Promise(resolve=>setTimeout(()=>resolve({state:'test-deadline-exceeded'}),220))]);
  assert.ok(performance.now()-started<260,'must return without a serverless timeout');
  return result;
};

test('hanging database outbox claim returns unconfirmed without dispatch', async () => {
  let dispatched=0, acked=0;
  const replay=makeOutboxReplay({store:{claimOutbox:hang,ackOutbox:async()=>{acked++}},dispatch:async()=>{dispatched++},worker:'w',timeoutMs:20});
  const result=await bounded(replay);
  assert.equal(result.state,'replay-unconfirmed');
  assert.equal(dispatched,0);assert.equal(acked,0);
});

test('hanging worker dispatch returns unconfirmed and never acknowledges the wake-up', async () => {
  let acked=0;
  const replay=makeOutboxReplay({store:{claimOutbox:async()=>event,ackOutbox:async()=>{acked++}},dispatch:hang,worker:'w',timeoutMs:20});
  const result=await bounded(replay);
  assert.equal(result.state,'replay-unconfirmed');assert.equal(acked,0);
});

test('late worker acceptance cannot acknowledge after deadline', async () => {
  let release, acked=0;
  const dispatch=()=>new Promise(resolve=>{release=resolve});
  const replay=makeOutboxReplay({store:{claimOutbox:async()=>event,ackOutbox:async()=>{acked++;return true}},dispatch,worker:'w',timeoutMs:20});
  const result=await bounded(replay);
  assert.equal(result.state,'replay-unconfirmed');
  release({state:'dispatched',ticket:'T1'});
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(acked,0);
});

test('fast authenticated dispatch still atomically acknowledges its event', async () => {
  let acked=0;
  const replay=makeOutboxReplay({store:{claimOutbox:async()=>event,ackOutbox:async(id,token)=>{assert.equal(id,1);assert.equal(token,event.lease_token);acked++;return true}},dispatch:async()=>({state:'dispatched',ticket:'T1'}),worker:'w',timeoutMs:100});
  const result=await replay();assert.equal(result.state,'acked');assert.equal(acked,1);
});

test('invalid deadline is rejected instead of silently disabling bounded replay',()=>{
  assert.throws(()=>makeOutboxReplay({store:{claimOutbox:async()=>null,ackOutbox:async()=>true},dispatch:async()=>({state:'idle'}),worker:'w',timeoutMs:0}),/deadline/);
});

test('late outbox lease acquisition does not launch a worker after HTTP deadline', async () => {
  let releaseClaim, dispatched=0, acked=0;
  const claimOutbox=()=>new Promise(resolve=>{releaseClaim=resolve});
  const replay=makeOutboxReplay({store:{claimOutbox,ackOutbox:async()=>{acked++;return true}},dispatch:async()=>{dispatched++;return {state:'dispatched',ticket:'T1'}},worker:'w',timeoutMs:20});
  const result=await bounded(replay);
  assert.equal(result.state,'replay-unconfirmed');
  releaseClaim(event);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(dispatched,0);assert.equal(acked,0);
});
