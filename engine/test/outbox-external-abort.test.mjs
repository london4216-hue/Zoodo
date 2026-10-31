import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOutboxReplay} from '../ops/relay/outbox-replay.mjs';
const LEASE='11111111-1111-4111-8111-111111111111';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};

test('external deadline while outbox claim is pending responds promptly and fences late worker',async()=>{
 const claim=deferred(),ctrl=new AbortController();let workers=0,acks=0;
 const replay=makeOutboxReplay({store:{claimOutbox:()=>claim.promise,ackOutbox:async()=>{acks++;return true}},
   dispatch:async()=>{workers++;return {state:'dispatched'}},worker:'w',timeoutMs:1000});
 const started=performance.now(),pending=replay(ctrl.signal);
 setTimeout(()=>ctrl.abort(),20);
 const result=await pending;
 assert.equal(result.state,'replay-unconfirmed');
 assert.ok(performance.now()-started<300,'external abort must not wait for own 1s timer');
 claim.resolve({id:1,ticket_id:'T1',lease_token:LEASE});await wait(10);
 assert.equal(workers,0);assert.equal(acks,0);
});

test('external deadline during worker dispatch aborts worker signal and leaves outbox unacked',async()=>{
 const ctrl=new AbortController();let seenSignal,acked=0;
 const replay=makeOutboxReplay({store:{claimOutbox:async()=>({id:1,ticket_id:'T1',lease_token:LEASE}),
   ackOutbox:async()=>{acked++;return true}},
   dispatch:async(_worker,_replacement,signal)=>{
     seenSignal=signal;
     await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
     return {state:'dispatched'};
   },worker:'w',timeoutMs:1000});
 const pending=replay(ctrl.signal);setTimeout(()=>ctrl.abort(),20);
 const result=await pending;assert.equal(result.state,'replay-unconfirmed');
 assert.equal(seenSignal.aborted,true);await wait(5);assert.equal(acked,0);
});

test('normal replay still acknowledges a genuinely accepted dispatch',async()=>{
 let acked=0;
 const replay=makeOutboxReplay({store:{claimOutbox:async()=>({id:1,ticket_id:'T1',lease_token:LEASE}),
  ackOutbox:async()=>{acked++;return true}},
  dispatch:async()=>({state:'dispatched',ticket:'T1'}),worker:'w',timeoutMs:100});
 const result=await replay();assert.equal(result.state,'acked');assert.equal(acked,1);
});

test('already-aborted external signal performs no database claim',async()=>{
 let claims=0;const ctrl=new AbortController();ctrl.abort();
 const replay=makeOutboxReplay({store:{claimOutbox:async()=>{claims++},ackOutbox:async()=>true},
  dispatch:async()=>({state:'dispatched'}),worker:'w'});
 const result=await replay(ctrl.signal);assert.equal(result.state,'replay-unconfirmed');assert.equal(claims,0);
});
