import test from 'node:test';
import assert from 'node:assert/strict';
import {runSupervisorContingent} from '../ops/relay/supervisor-contingent.mjs';

async function run(outcome) {
  const controller = new AbortController();
  const events = [];
  const result = await runSupervisorContingent({
    store: {claimOutbox:async()=>null, ackOutbox:async()=>true, recoverOutbox:async()=>0},
    relay: {next:async()=>({state:'idle'})},
    workerIds:['adler'], signal:controller.signal,
    drainOne:async()=>outcome,
    sleep:async()=>{},
    onCycle:event=>{events.push(event);if(event.type==='cycle')controller.abort()}
  });
  assert.equal(result.cycles,1);
  return events.find(e=>e.type==='cycle');
}

test('supervisor never exposes arbitrary provider diagnostics in telemetry',async()=>{
  const secret='Authorization: Bearer private-token';
  const event=await run({state:{message:secret},eventId:{header:secret},diagnostics:secret});
  assert.deepEqual(event,{type:'cycle',state:'unknown',eventId:null});
  assert.equal(JSON.stringify(event).includes(secret),false);
});

test('supervisor preserves bounded known state and positive event ID',async()=>{
  assert.deepEqual(await run({state:'acknowledged',eventId:7}),
    {type:'cycle',state:'acknowledged',eventId:7});
  assert.deepEqual(await run({state:'recovery_required',eventId:-7}),
    {type:'cycle',state:'recovery_required',eventId:null});
});
