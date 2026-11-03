import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLocalLoop } from '../ops/local-automation-loop.mjs';

test('local loop runs one tick and reports', async () => {
  const good = { agent_id: 't', timestamp: new Date().toISOString(), action: 'test', evidence_hash: 'abcdef12' };
  const r = await runLocalLoop({ manifests: [good], maxRuns: 1, intervalMs: 0, onTick: () => {} });
  assert.equal(r.ok, true);
  assert.equal(r.runs, 1);
});
