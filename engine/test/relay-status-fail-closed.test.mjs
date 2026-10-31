import test from 'node:test';
import assert from 'node:assert/strict';
import {relayResponseStatus} from '../ops/relay/relay-response-status.mjs';

test('only documented durable relay states receive HTTP 200', () => {
  const success = {
    kick:['dispatched','delegated','idle'],
    replay:['acked','empty','idle-settled'],
    reconcile:['reconciled'],
    completed:['completed'],
    not_started:['requeued']
  };
  for (const [type, states] of Object.entries(success)) {
    for (const state of states) assert.equal(relayResponseStatus(type,{state}),200,`${type}/${state}`);
  }
});

test('unconfirmed, uncertain, missing or unexpected state receives HTTP 503', () => {
  for (const type of ['kick','replay','reconcile','completed','not_started']) {
    for (const result of [null,undefined,{}, {state:'uncertain'}, {state:'unknown'},
      {state:'recovery_required'}, {state:'next-unconfirmed'},
      {state:'completion-unconfirmed'}, {state:'requeue-unconfirmed'},
      {state:'reconcile-unconfirmed'}, {state:'ack-unconfirmed'}]) {
      assert.equal(relayResponseStatus(type,result),503,`${type}/${result?.state??'missing'}`);
    }
  }
});

test('committed transition stays acknowledged when NEXT is unconfirmed', () => {
  assert.equal(relayResponseStatus('completed',{state:'completed',next:{state:'next-unconfirmed'}}),200);
  assert.equal(relayResponseStatus('not_started',{state:'requeued',next:{state:'recovery_required'}}),200);
});

test('unknown event type cannot be acknowledged', () => {
  assert.equal(relayResponseStatus('unsupported',{state:'completed'}),503);
});
