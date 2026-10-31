import test from 'node:test';
import assert from 'node:assert/strict';
import {kickWithDeadline} from '../ops/relay/bounded-kick.mjs';

test('authenticated kick forwards a cancellation signal and returns a real dispatch receipt', async () => {
  let observed;
  const relay = {next: async (worker, replacement, signal) => {
    observed = {worker, replacement, signal};
    return {state:'dispatched',ticket:'T2',worker};
  }};
  const result = await kickWithDeadline(relay,'worker-b',{timeoutMs:100});
  assert.equal(result.state,'dispatched');
  assert.equal(result.ticket,'T2');
  assert.equal(observed.worker,'worker-b');
  assert.equal(observed.replacement,true);
  assert.equal(observed.signal.aborted,false);
});

test('hanging kick returns an unconfirmed checkpoint within the deadline', async () => {
  let observedSignal;
  const relay = {next: (_worker,_replacement,signal) => {
    observedSignal=signal;
    return new Promise(()=>{});
  }};
  const started=performance.now();
  const result=await kickWithDeadline(relay,'worker-b',{timeoutMs:20});
  assert.equal(result.state,'next-unconfirmed');
  assert.equal(observedSignal.aborted,true);
  assert.ok(performance.now()-started<250);
});

test('late atomic claim after kick timeout is fenced before dispatch', async () => {
  let finishClaim, workerInvocations=0;
  const relay={next:async(_worker,_replacement,signal)=>{
    await new Promise(resolve=>{finishClaim=resolve});
    if(signal.aborted)return {state:'next-unconfirmed',reason:'late claim fenced'};
    workerInvocations++;
    return {state:'dispatched'};
  }};
  const result=await kickWithDeadline(relay,'worker-b',{timeoutMs:15});
  assert.equal(result.state,'next-unconfirmed');
  finishClaim();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(workerInvocations,0);
});

test('kick rejects invalid callback and unbounded deadline', async () => {
  await assert.rejects(()=>kickWithDeadline({},'w'),/NEXT relay required/);
  await assert.rejects(()=>kickWithDeadline({next:async()=>({state:'idle'})},'w',{timeoutMs:Infinity}),/bounded deadline/);
});
