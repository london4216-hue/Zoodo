import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOutboxReplay} from '../ops/relay/outbox-replay.mjs';
const event={id:42,ticket_id:'T1',lease_token:'00000000-0000-4000-8000-000000000001'};

test('idle after final ticket atomically settles obsolete wakeup',async()=>{
 const order=[];
 const replay=makeOutboxReplay({worker:'w',store:{
   claimOutbox:async()=>{order.push('claim');return event},
   ackOutbox:async()=>{throw Error('must not use dispatch ack')},
   settleIdleOutbox:async(id,token)=>{order.push('settle');assert.equal(id,42);assert.equal(token,event.lease_token);return true}
 },dispatch:async()=>{order.push('dispatch');return {state:'idle'}}});
 assert.deepEqual(await replay(),{state:'idle-settled',event_id:42});
 assert.deepEqual(order,['claim','dispatch','settle']);
});

test('busy worker with eligible queued ticket cannot settle idle wakeup',async()=>{
 const replay=makeOutboxReplay({worker:'w',store:{
   claimOutbox:async()=>event,ackOutbox:async()=>true,settleIdleOutbox:async()=>false
 },dispatch:async()=>({state:'idle'})});
 assert.equal((await replay()).state,'retry-after-lease');
});

test('uncertain worker never invokes idle settlement',async()=>{
 let called=0;
 const replay=makeOutboxReplay({worker:'w',store:{
   claimOutbox:async()=>event,ackOutbox:async()=>true,
   settleIdleOutbox:async()=>{called++;return true}
 },dispatch:async()=>({state:'uncertain'})});
 assert.equal((await replay()).state,'retry-after-lease');
 assert.equal(called,0);
});

test('old store without idle RPC fails closed and preserves outbox lease',async()=>{
 const replay=makeOutboxReplay({worker:'w',store:{
   claimOutbox:async()=>event,ackOutbox:async()=>true
 },dispatch:async()=>({state:'idle'})});
 assert.equal((await replay()).state,'retry-after-lease');
});
