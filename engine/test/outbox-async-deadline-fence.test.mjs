import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id: 7, ticket_id: 'T1', lease_token: '12345678-1234-4234-8234-123456789012'};
const receipt = {state: 'dispatched', ticket: 'T1', worker: 'workerA', receipt_url: 'https://runner.example/receipts/T1'};
const pending = () => new Promise(() => {});
const guard = promise => Promise.race([
  promise,
  new Promise(resolve => setTimeout(() => resolve({state: 'hung'}), 75))
]);
const store = () => ({claimOutbox: async () => lease, ackOutbox: async () => true, settleIdleOutbox: async () => true});

test('unresolved relay callback returns uncertain recovery without ACK or second worker', async () => {
  const calls = [];
  const s = store(); s.ackOutbox = async () => { calls.push('ack'); return true; };
  const relay = {next: async worker => { calls.push(worker); return pending(); }};
  const result = await guard(drainOne({store:s, relay, workerIds:['workerA','workerB'], operationTimeoutMs: 15}));
  assert.equal(result.state, 'recovery_required');
  assert.deepEqual(calls, ['workerA']);
});

test('unresolved ACK does not trigger second dispatch or report acknowledgment', async () => {
  const calls = [];
  const s = store(); s.ackOutbox = () => { calls.push('ack'); return pending(); };
  const relay = {next: async worker => { calls.push(worker); return receipt; }};
  const result = await guard(drainOne({store:s, relay, workerIds:['workerA','workerB'], operationTimeoutMs: 15}));
  assert.equal(result.state, 'recovery_required');
  assert.deepEqual(calls, ['workerA','ack']);
});

test('unresolved transactional idle settlement does not dispatch another worker', async () => {
  const calls = [];
  const s = store(); s.settleIdleOutbox = () => { calls.push('settle'); return pending(); };
  const relay = {next: async worker => { calls.push(worker); return {state:'idle'}; }};
  const result = await guard(drainOne({store:s, relay, workerIds:['workerA','workerB'], operationTimeoutMs: 15}));
  assert.equal(result.state, 'recovery_required');
  assert.deepEqual(calls, ['workerA','settle']);
});

test('unresolved initial claim fails boundedly without dispatch', async () => {
  const s = store(); s.claimOutbox = pending;
  const result = await guard(drainOne({store:s, relay:{next: () => {throw Error('must not dispatch');}}, workerIds:['workerA'], operationTimeoutMs: 15}).then(()=>'unexpected success', e => e.name));
  assert.equal(result, 'Error');
});

test('invalid deadline configuration is rejected before claiming any work', async () => {
  let claimed = false;
  const s = store(); s.claimOutbox = async () => { claimed = true; return lease; };
  await assert.rejects(drainOne({store:s, relay:{next:async()=>receipt}, workerIds:['workerA'], operationTimeoutMs: Infinity}));
  assert.equal(claimed, false);
});
