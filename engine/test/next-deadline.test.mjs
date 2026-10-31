import test from 'node:test';
import assert from 'node:assert/strict';
import {nextWithDeadline} from '../ops/relay/next-deadline.mjs';

test('successful NEXT dispatch preserves actual receipt', async () => {
  const result = {state:'dispatched',ticket:'T2',receipt_url:'https://example.org/receipt/T2'};
  assert.deepEqual(await nextWithDeadline(async()=>result,{timeoutMs:30}),result);
});

test('rejected NEXT returns recovery checkpoint without throwing', async () => {
  const result = await nextWithDeadline(async()=>{throw Error('private DB temporarily unavailable')},{timeoutMs:30});
  assert.equal(result.state,'recovery_required');
});

test('hanging NEXT cannot indefinitely block already-durable completion', async () => {
  const started = performance.now();
  const result = await nextWithDeadline(()=>new Promise(()=>{}),{timeoutMs:20});
  assert.equal(result.state,'next-unconfirmed');
  assert.ok(performance.now()-started < 250,'bounded return');
});

test('late NEXT completion cannot be misreported as a confirmed failure', async () => {
  let resolveLater;
  const inFlight = new Promise(resolve=>{resolveLater=resolve});
  const result = await nextWithDeadline(()=>inFlight,{timeoutMs:10});
  assert.equal(result.state,'next-unconfirmed');
  resolveLater({state:'dispatched',ticket:'T2'});
  await inFlight;
  assert.equal(result.state,'next-unconfirmed');
});

test('invalid/unbounded deadline is rejected', async () => {
  for (const timeoutMs of [0,-1,30001,Infinity,1.2]) {
    await assert.rejects(nextWithDeadline(()=>true,{timeoutMs}),/bounded deadline/);
  }
});
