import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmTransitionWithinDeadline} from '../ops/relay/transition-fence.mjs';

const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve}; };

test('durable transition confirmation before deadline permits NEXT', async () => {
  const result = await confirmTransitionWithinDeadline(async () => true, {timeoutMs:50});
  assert.deepEqual(result, {confirmed:true});
});

test('unconfirmed transition after deadline never permits NEXT', async () => {
  const gate=deferred();
  const started=performance.now();
  const result=await confirmTransitionWithinDeadline(() => gate.promise, {timeoutMs:15});
  assert.equal(result.confirmed,false);
  assert.equal(result.state,'transition-unconfirmed');
  assert.ok(performance.now()-started<250);
  gate.resolve(true);
  await new Promise(r=>setImmediate(r));
  assert.equal(result.confirmed,false);
});

test('rejected or false database receipt is never confirmed', async () => {
  await assert.rejects(() => confirmTransitionWithinDeadline(async () => false,{timeoutMs:30}), /not durably confirmed/);
  await assert.rejects(() => confirmTransitionWithinDeadline(async () => {throw Error('DB down')},{timeoutMs:30}), /DB down/);
});

test('invalid deadline and transition callback fail closed', async () => {
  await assert.rejects(() => confirmTransitionWithinDeadline(null),/Valid transition/);
  await assert.rejects(() => confirmTransitionWithinDeadline(async()=>true,{timeoutMs:Infinity}),/Valid transition/);
});
