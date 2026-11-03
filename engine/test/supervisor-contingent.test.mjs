import test from 'node:test';
import assert from 'node:assert/strict';
import {runSupervisorContingent} from '../ops/relay/supervisor-contingent.mjs';

function setup(ids=['T1','T2']) {
  const ready=[...ids], active=new Set(), completed=[], dispatches=[];
  const store={
    claimOutbox:async()=>{const id=ready.shift();if(!id)return null;active.add(id);return {id,lease_token:id}},
    ackOutbox:async id=>{assert.ok(active.delete(id));completed.push(id);return true},
    recoverOutbox:async()=>0
  };
  const relay={next:async worker=>{dispatches.push(worker);return {state:'dispatched'}}};
  const drainOne=async ({store,relay,workerIds})=>{
    const event=await store.claimOutbox();
    if(!event)return {state:'empty'};
    const result=await relay.next(workerIds[0]);
    assert.equal(result.state,'dispatched');
    await store.ackOutbox(event.id,event.lease_token);
    return {state:'acknowledged',eventId:event.id};
  };
  return {store,relay,drainOne,completed,ready,dispatches};
}
const instant=async()=>{};

test('surviving peer completes next ticket after first supervisor stops',async()=>{
  const f=setup(), first=new AbortController(), second=new AbortController();
  const events=[];
  await runSupervisorContingent({...f,workerIds:['adler'],signal:first.signal,sleep:instant,
    onCycle:e=>{events.push(e);if(e.type==='cycle')first.abort()}});
  assert.deepEqual(f.completed,['T1']);
  const result=await runSupervisorContingent({...f,workerIds:['adler'],signal:second.signal,sleep:instant,
    onCycle:e=>{if(e.type==='cycle')second.abort()}});
  assert.deepEqual(f.completed,['T1','T2']);
  assert.deepEqual(f.dispatches,['adler','adler']);
  assert.equal(result.state,'stopped');
  assert.ok(events.some(e=>e.type==='recovered'));
});

test('failed recovery does not dispatch; surviving peer can recover and drain',async()=>{
  const f=setup(['T1']), a=new AbortController(), b=new AbortController();
  let calls=0;
  const failingStore={...f.store,recoverOutbox:async()=>{calls++;throw Error('database down')}};
  const onFail=e=>{if(e.type==='recovery_error')a.abort()};
  await runSupervisorContingent({...f,store:failingStore,workerIds:['adler'],signal:a.signal,sleep:instant,onCycle:onFail});
  assert.equal(calls,1);assert.deepEqual(f.completed,[]);
  await runSupervisorContingent({...f,workerIds:['adler'],signal:b.signal,sleep:instant,
    onCycle:e=>{if(e.type==='cycle')b.abort()}});
  assert.deepEqual(f.completed,['T1']);
});

test('telemetry exceptions cannot stop the shared-queue worker',async()=>{
  const f=setup(['T1']), controller=new AbortController();
  const result=await runSupervisorContingent({...f,workerIds:['adler'],signal:controller.signal,sleep:instant,
    onCycle:e=>{if(e.type==='cycle')controller.abort();throw Error('metrics down')}});
  assert.equal(result.cycles,1);assert.deepEqual(f.completed,['T1']);
});

test('rejects a nontransactional store and invalid cadence before dispatch',async()=>{
  const f=setup(), controller=new AbortController();
  await assert.rejects(runSupervisorContingent({...f,store:{...f.store,recoverOutbox:null},workerIds:['adler'],signal:controller.signal}),/Qualified shared store/);
  await assert.rejects(runSupervisorContingent({...f,workerIds:['adler'],signal:controller.signal,intervalMs:0}),/Qualified shared store/);
  assert.deepEqual(f.completed,[]);
});
