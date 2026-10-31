import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOutboxReplay} from '../ops/relay/outbox-replay.mjs';
const token = '00000000-0000-4000-8000-000000000001';
const event = {id: 42, ticket_id: 'T2', lease_token: token};
const store = (claim, ack = async () => true) => ({claimOutbox: claim, ackOutbox: ack});

test('empty outbox does not invoke worker', async () => {
  let called = 0;
  const replay = makeOutboxReplay({store: store(async () => null), worker: 'worker-1', dispatch: async () => {called++;}});
  assert.deepEqual(await replay(), {state: 'empty'});
  assert.equal(called, 0);
});

test('durable wake-up atomically claimed then acknowledged only after dispatch', async () => {
  const order = [];
  const replay = makeOutboxReplay({
    store: store(async () => {order.push('claim'); return event;}, async (id, lease) => {order.push('ack'); assert.equal(id, 42); assert.equal(lease, token); return true;}),
    worker: 'worker-1', dispatch: async (w) => {order.push('dispatch'); assert.equal(w, 'worker-1'); return {state: 'dispatched', ticket: 'T2'};}
  });
  assert.equal((await replay()).state, 'acked');
  assert.deepEqual(order, ['claim', 'dispatch', 'ack']);
});

test('uncertain worker does not acknowledge durable wake-up', async () => {
  let acks = 0;
  const replay = makeOutboxReplay({store: store(async () => event, async () => {acks++; return true;}), worker: 'worker-1', dispatch: async () => ({state: 'uncertain', ticket: 'T1'})});
  assert.equal((await replay()).state, 'retry-after-lease');
  assert.equal(acks, 0);
});

test('replacement dispatch is valid, but failed ack remains unconfirmed', async () => {
  const replay = makeOutboxReplay({store: store(async () => event, async () => false), worker: 'worker-1', dispatch: async () => ({state: 'uncertain', replacement: {state: 'dispatched', ticket: 'T2'}})});
  assert.equal((await replay()).state, 'ack-unconfirmed');
});

test('worker error leaves event for recovery, no ack', async () => {
  let acks = 0;
  const replay = makeOutboxReplay({store: store(async () => event, async () => {acks++; return true;}), worker: 'worker-1', dispatch: async () => {throw Error('timeout');}});
  assert.equal((await replay()).state, 'retry-after-lease');
  assert.equal(acks, 0);
});

test('invalid lease fails closed before worker invocation', async () => {
  let calls = 0;
  const replay = makeOutboxReplay({store: store(async () => ({...event, lease_token: 'forged'})), worker: 'worker-1', dispatch: async () => {calls++;}});
  await assert.rejects(replay(), /Invalid durable outbox lease/);
  assert.equal(calls, 0);
});
