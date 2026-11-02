import test from 'node:test';
import assert from 'node:assert/strict';
import {runSupervisorContingent} from '../ops/relay/supervisor-contingent.mjs';

function fixture(now) {
  const controller=new AbortController();
  const actions=[];
  const store={claimOutbox:async()=>null,ackOutbox:async()=>true,recoverOutbox:async()=>{actions.push('recover');return 0}};
  const relay={next:async()=>({state:'idle'})};
  const drainOne=async()=>{actions.push('dispatch');return {state:'empty'}};
  const onCycle=e=>{if(e.type==='clock_error'||e.type==='recovery_error'||e.type==='cycle')controller.abort()};
  return {controller,actions,store,relay,drainOne,onCycle,now,workerIds:['adler'],sleep:async()=>{}};
}

test('invalid first clock sample fails closed before recovery or dispatch',async()=>{
  const f=fixture(()=>NaN);
  const result=await runSupervisorContingent({...f,signal:f.controller.signal});
  assert.deepEqual(f.actions,[]);
  assert.equal(result.cycles,0);
});

test('throwing clock callback fails closed before dispatch',async()=>{
  const f=fixture(()=>{throw Error('clock offline')});
  const result=await runSupervisorContingent({...f,signal:f.controller.signal});
  assert.deepEqual(f.actions,[]);
  assert.equal(result.cycles,0);
});

test('recovery deadline overflow prevents dispatch',async()=>{
  const f=fixture(()=>Number.MAX_SAFE_INTEGER);
  const result=await runSupervisorContingent({...f,signal:f.controller.signal});
  assert.deepEqual(f.actions,['recover']);
  assert.equal(result.cycles,0);
});

test('one valid clock sample suffices for recovery deadline and dispatch',async()=>{
  let samples=0;
  const f=fixture(()=>{samples++;if(samples>1)throw Error('unexpected extra clock read');return 1000});
  const result=await runSupervisorContingent({...f,signal:f.controller.signal});
  assert.deepEqual(f.actions,['recover','dispatch']);
  assert.equal(result.cycles,1);
});
