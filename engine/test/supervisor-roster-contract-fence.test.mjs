import test from 'node:test';
import assert from 'node:assert/strict';
import {runSupervisorContingent} from '../ops/relay/supervisor-contingent.mjs';

function args(workerIds) {
  const controller = new AbortController();
  controller.abort();
  return {
    store: {claimOutbox: async () => null, ackOutbox: async () => true, recoverOutbox: async () => 0},
    relay: {next: async () => ({state:'idle'})},
    drainOne: async () => ({state:'empty'}),
    workerIds,
    signal: controller.signal,
  };
}

test('supervisor rejects worker IDs the outbox drainer cannot dispatch', async () => {
  for (const invalid of ['adler worker', 'adler\u200b', 'x'.repeat(65), 'worker/name']) {
    await assert.rejects(runSupervisorContingent(args([invalid])), /Qualified shared store/, invalid);
  }
});

test('supervisor accepts the same valid 64-character worker ID as the drainer', async () => {
  const result = await runSupervisorContingent(args(['x'.repeat(64), 'adler_2']));
  assert.equal(result.state, 'stopped');
  assert.equal(result.cycles, 0);
});
