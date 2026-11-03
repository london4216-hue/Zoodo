import test from 'node:test';
import assert from 'node:assert/strict';
import {runSupervisorContingent} from '../ops/relay/supervisor-contingent.mjs';

function setup(samples, recover) {
  const controller = new AbortController();
  let sample = 0;
  const actions = [];
  let dispatches = 0;
  const store = {
    claimOutbox: async () => null,
    ackOutbox: async () => true,
    recoverOutbox: async () => { actions.push('recover'); return recover(actions.filter(x => x === 'recover').length); }
  };
  const relay = {next: async () => ({state:'idle'})};
  const drainOne = async () => { actions.push('dispatch'); dispatches++; return {state:'empty'}; };
  let waits = 0;
  const sleep = async () => { if (++waits >= 5) controller.abort(); };
  const now = () => samples[Math.min(sample++, samples.length - 1)];
  return {store,relay,drainOne,now,sleep,actions,controller,workerIds:['adler'],
    onCycle: e => { if (e.type === 'cycle' && dispatches >= 3) controller.abort(); }};
}

test('clock rollback forces recovery before the next dispatch', async () => {
  const f = setup([10000,100,101], async () => 0);
  const result = await runSupervisorContingent({...f,signal:f.controller.signal});
  assert.deepEqual(f.actions.slice(0,4),['recover','dispatch','recover','dispatch']);
  assert.equal(result.recoveryAttempts,2);
});

test('failed rollback recovery stays required until a successful retry', async () => {
  const f = setup([10000,100,101], async attempt => {
    if (attempt === 2) throw Error('database temporarily unavailable');
    return 0;
  });
  const result = await runSupervisorContingent({...f,signal:f.controller.signal});
  assert.deepEqual(f.actions.slice(0,5),['recover','dispatch','recover','recover','dispatch']);
  assert.equal(result.recoveryAttempts,2);
});
