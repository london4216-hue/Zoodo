import test from 'node:test';
import assert from 'node:assert/strict';
import { executeSyntheticProbe, PROBE_INPUT } from '../scripts/runner-synthetic-probe.mjs';

test('bounded synthetic task returns deterministic independently checkable hashes', () => {
  const first = executeSyntheticProbe(PROBE_INPUT);
  const second = executeSyntheticProbe(PROBE_INPUT);
  assert.equal(first.input_sha256, '080ba0ccfa7b13f09b07ba727911bb525164856d37834ca88c8ddf873997ebe2');
  assert.equal(first.output_sha256, '914b365ab4e0a61ee3cd3f35ff2b56c3a6fd46728f1d46239058a8779143088d');
  assert.equal(first.output_sha256, second.output_sha256);
  assert.equal(first.task_type, 'bounded-sha256');
  assert.equal(first.network_calls, 0);
  assert.equal(first.external_model_calls, 0);
  assert.ok(first.elapsed_ms >= 0 && first.elapsed_ms < 10000);
  console.log('ZOO_SYNTHETIC_EXECUTION_PROBE ' + JSON.stringify({
    task_type: first.task_type,
    input_sha256: first.input_sha256,
    output_sha256: first.output_sha256,
    source_commit: /^[0-9a-f]{40}$/.test(process.env.COMMIT_REF || '') ? process.env.COMMIT_REF : null,
    provider: process.env.NETLIFY ? 'netlify-build' : 'local-node',
    execution_at: new Date().toISOString(),
    latency_ms: first.elapsed_ms,
    cost_usd: null,
    qualification_scope: 'synthetic build-time computation only; not a durable scheduler or authenticated AI model call'
  }));
});

test('rejects arbitrary payloads rather than executing unbounded tasks', () => {
  assert.throws(() => executeSyntheticProbe('not-allowlisted'), /not allowlisted/);
});
