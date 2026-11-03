import test from 'node:test';
import assert from 'node:assert/strict';
import {runSupervisorContingent} from '../ops/relay/supervisor-contingent.mjs';

test('rejected asynchronous telemetry never crashes or interrupts completed dispatch', async () => {
  const controller = new AbortController();
  const completed = [];
  const result = await runSupervisorContingent({
    store: {
      claimOutbox: async () => null,
      ackOutbox: async () => true,
      recoverOutbox: async () => 0,
    },
    relay: {next: async () => ({state:'idle'})},
    workerIds: ['adler'],
    signal: controller.signal,
    drainOne: async () => { completed.push('ticket-1'); return {state:'acknowledged',eventId:1}; },
    sleep: async () => {},
    onCycle: async event => {
      if (event.type === 'cycle') controller.abort();
      throw Error('asynchronous telemetry provider failure');
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(completed, ['ticket-1']);
  assert.equal(result.cycles, 1);
  assert.equal(result.state, 'stopped');
});
