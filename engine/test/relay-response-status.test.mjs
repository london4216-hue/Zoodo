import test from 'node:test';
import assert from 'node:assert/strict';
import {relayResponseStatus} from '../ops/relay/relay-response-status.mjs';

test('bounded kick/replay/reconcile failures return retryable HTTP 503', () => {
  for (const [type, state] of [
    ['kick','next-unconfirmed'], ['kick','recovery_required'],
    ['replay','replay-unconfirmed'], ['replay','retry-after-lease'],
    ['replay','ack-unconfirmed'], ['reconcile','reconcile-unconfirmed']
  ]) assert.equal(relayResponseStatus(type,{state}),503,`${type}: ${state}`);
});

test('durably confirmed or idle outcomes remain HTTP 200', () => {
  for (const [type, state] of [
    ['kick','dispatched'],['kick','idle'],['replay','acked'],
    ['replay','empty'],['replay','idle-settled'],['reconcile','reconciled']
  ]) assert.equal(relayResponseStatus(type,{state}),200,`${type}: ${state}`);
});

test('completed transition is not retried solely because NEXT is unconfirmed', () => {
  assert.equal(relayResponseStatus('completed',{state:'completed',next:{state:'next-unconfirmed'}}),200);
  assert.equal(relayResponseStatus('not_started',{state:'requeued',next:{state:'next-unconfirmed'}}),200);
});

test('unexpected or missing results cannot be acknowledged as durable success', () => {
  for (const result of [null,undefined,{}, {state:'unknown'}, {state:'uncertain'}]) {
    assert.equal(relayResponseStatus('replay',result),503);
  }
});
