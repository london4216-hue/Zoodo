import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileWithDeadline} from '../ops/relay/reconcile-bounded.mjs';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('slow quarantine is bounded and does not launch later recovery or worker',async()=>{
 const gate=deferred();let recover=0,replay=0;
 const result=await reconcileWithDeadline({quarantine:()=>gate.promise,recover:async()=>{recover++},replay:async()=>{replay++},timeoutMs:20});
 assert.equal(result.state,'reconcile-unconfirmed');assert.equal(result.phase,'deadline');
 gate.resolve(1);await wait(10);
 assert.equal(recover,0);assert.equal(replay,0);
});

test('slow recovery is bounded and cannot launch late replay',async()=>{
 const gate=deferred();let replay=0;
 const result=await reconcileWithDeadline({quarantine:async()=>1,recover:()=>gate.promise,replay:async()=>{replay++},timeoutMs:20});
 assert.equal(result.state,'reconcile-unconfirmed');
 gate.resolve(2);await wait(10);assert.equal(replay,0);
});

test('inflight replay receives abort signal and no false reconciliation',async()=>{
 let seenSignal,aborted=false;
 const result=await reconcileWithDeadline({quarantine:async()=>1,recover:async()=>2,replay:async signal=>{
   seenSignal=signal;await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve()}, {once:true}));
   return {state:'replay-unconfirmed'};
 },timeoutMs:20});
 assert.equal(result.state,'reconcile-unconfirmed');assert.equal(aborted,true);assert.equal(seenSignal.aborted,true);
});

test('fast reconciliation reports actual stage counts and replay receipt',async()=>{
 const result=await reconcileWithDeadline({quarantine:async()=>1,recover:async()=>2,replay:async signal=>{
  assert.equal(signal.aborted,false);return {state:'acked',event_id:3};
 },timeoutMs:100});
 assert.deepEqual(result,{state:'reconciled',quarantined:1,recovered:2,wakeup:{state:'acked',event_id:3}});
});

test('stage exception reports unconfirmed without inventing recovered count',async()=>{
 const result=await reconcileWithDeadline({quarantine:async()=>1,recover:async()=>{throw Error('private token')},replay:async()=>{},timeoutMs:100});
 assert.equal(result.state,'reconcile-unconfirmed');assert.equal(result.phase,'recover');
 assert.equal(JSON.stringify(result).includes('private token'),false);
});

test('unconfirmed outbox dispatch never becomes a reconciled success',async()=>{
 const result=await reconcileWithDeadline({quarantine:async()=>0,recover:async()=>0,
  replay:async()=>({state:'retry-after-lease',event_id:7}),timeoutMs:100});
 assert.equal(result.state,'reconcile-unconfirmed');assert.equal(result.phase,'replay');
});
