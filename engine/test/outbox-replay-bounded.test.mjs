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

test('two distinct local HTTP tickets: first uncertain, second acknowledged without duplicate', async () => {
  const {createServer} = await import('node:http');
  const {once} = await import('node:events');
  const seen=[]; const acked=[];
  const server=createServer(async(req,res)=>{
    let raw='';for await(const part of req)raw+=part;
    const payload=JSON.parse(raw);seen.push(payload.ticket_id);
    res.writeHead(202,{'content-type':'application/json'});
    res.end(JSON.stringify({accepted:true,ticket_id:payload.ticket_id}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try {
    const events=[{...event,id:1,ticket_id:'T1'},{...event,id:2,ticket_id:'T2'}];
    let calls=0;
    const replay=makeOutboxReplay({
      store:{claimOutbox:async()=>events.shift()??null,ackOutbox:async(id)=>{acked.push(id);return true}},
      dispatch:async()=>{
        calls++;
        if(calls===1) return {state:'uncertain',ticket:'T1'};
        const response=await fetch(`http://127.0.0.1:${server.address().port}/work`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ticket_id:'T2'})});
        assert.equal(response.status,202);
        assert.equal((await response.json()).ticket_id,'T2');
        return {state:'dispatched',ticket:'T2'};
      },worker:'w',timeoutMs:2000
    });
    assert.equal((await replay()).state,'retry-after-lease');
    assert.equal((await replay()).state,'acked');
    assert.deepEqual(seen,['T2']);assert.deepEqual(acked,[2]);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
