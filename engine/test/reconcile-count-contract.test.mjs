import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileWithDeadline} from '../ops/relay/reconcile-bounded.mjs';

test('invalid quarantine count cannot produce false success', async () => {
  let recoveryCalls = 0;
  const result = await reconcileWithDeadline({
    quarantine: async () => null,
    recover: async () => { recoveryCalls++; return 0; },
    replay: async () => ({state:'empty'}),
    timeoutMs: 100
  });
  assert.equal(result.state, 'reconcile-unconfirmed');
  assert.equal(result.phase, 'quarantine');
  assert.equal(recoveryCalls, 0);
});

test('invalid recovery count cannot produce false success', async () => {
  let replayCalls = 0;
  const result = await reconcileWithDeadline({
    quarantine: async () => 0,
    recover: async () => false,
    replay: async () => { replayCalls++; return {state:'empty'}; },
    timeoutMs: 100
  });
  assert.equal(result.state, 'reconcile-unconfirmed');
  assert.equal(result.phase, 'recover');
  assert.equal(replayCalls, 0);
});

test('valid empty counts permit reconciliation', async () => {
  const result = await reconcileWithDeadline({
    quarantine: async () => 0,
    recover: async () => 0,
    replay: async () => ({state:'empty'}),
    timeoutMs: 100
  });
  assert.equal(result.state, 'reconciled');
});
