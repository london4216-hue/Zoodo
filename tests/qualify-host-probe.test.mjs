import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { qualifyNetlifyHost } from '../scripts/qualify-host-probe.mjs';
const token = 'synthetic-test-token-only-1234567890abcdef';
const expectedSha = 'a'.repeat(40);
const nonce = 'synthetic_probe_20261031';
const endpoint = 'https://deploy-preview-38--zoo-live-dashboard.netlify.app/.netlify/functions/zoo-host-probe';
const base = { endpoint, token, expectedSha, nonce, allowedHosts: ['deploy-preview-38--zoo-live-dashboard.netlify.app'],
  now: () => new Date('2026-10-31T06:00:00Z') };
const good = { schema_version: 1, execution_type: 'synthetic-only', provider_runtime: 'netlify-functions-node',
  invocation_id: 'app-generated-id-not-native', source_commit_sha: expectedSha,
  output_sha256: createHash('sha256').update('zoo-host-probe-v1:' + nonce).digest('hex'),
  durable_queue_verified: false, external_ai_invoked: false };
const mock = (body = good, nativeId = 'netlify_native_123456', status = 200) => async () => ({
  status, headers: { get: (key) => key === 'x-nf-request-id' ? nativeId : null }, json: async () => body,
});
test('no credentials means no network request', async () => {
  let called = false;
  const r = await qualifyNetlifyHost({ ...base, token: '', fetchImpl: () => { called = true; } });
  assert.equal(r.status, 'BLOCKED'); assert.equal(r.reason, 'credential_unavailable'); assert.equal(called, false);
});
test('rejects non-Netlify and non-HTTPS endpoints', async () => {
  for (const bad of ['https://evil.netlify.app.evil.test/.netlify/functions/zoo-host-probe',
    'http://deploy-preview-38--zoo-live-dashboard.netlify.app/.netlify/functions/zoo-host-probe',
    'https://deploy-preview-38--zoo-live-dashboard.netlify.app/other']) {
    const r = await qualifyNetlifyHost({ ...base, endpoint: bad, fetchImpl: mock() });
    assert.equal(r.status, 'BLOCKED');
  }
});
test('valid HTTP result without native provider header stays UNKNOWN', async () => {
  const r = await qualifyNetlifyHost({ ...base, fetchImpl: mock(good, null) });
  assert.equal(r.status, 'UNKNOWN'); assert.equal(r.host_execution_verified, false);
  assert.equal(r.application_invocation_id, 'app-generated-id-not-native');
});
test('exact SHA mismatch is not counted as hosted proof', async () => {
  const r = await qualifyNetlifyHost({ ...base, fetchImpl: mock({ ...good, source_commit_sha: 'b'.repeat(40) }) });
  assert.equal(r.reason, 'source_sha_mismatch'); assert.equal(r.host_execution_verified, false);
});
test('incorrect output digest is not counted as execution', async () => {
  const r = await qualifyNetlifyHost({ ...base, fetchImpl: mock({ ...good, output_sha256: '0'.repeat(64) }) });
  assert.equal(r.reason, 'invalid_synthetic_execution_result'); assert.equal(r.host_execution_verified, false);
});
test('real response structure yields HOST_PROBE_PASS, never runner qualification', async () => {
  const r = await qualifyNetlifyHost({ ...base, fetchImpl: mock() });
  assert.equal(r.status, 'HOST_PROBE_PASS'); assert.equal(r.host_execution_verified, true);
  assert.equal(r.runner_qualified, false); assert.equal(r.durable_queue_verified, false);
  assert.equal(r.provider_request_id, 'netlify_native_123456');
});
test('provider HTTP failure is RECOVERING', async () => {
  const r = await qualifyNetlifyHost({ ...base, fetchImpl: mock(good, null, 503) });
  assert.equal(r.status, 'RECOVERING'); assert.equal(r.reason, 'provider_http_503');
});
test('transport errors do not disclose tokens', async () => {
  const r = await qualifyNetlifyHost({ ...base, fetchImpl: async () => { throw Error('secret ' + token); } });
  assert.equal(r.status, 'RECOVERING'); assert.ok(!JSON.stringify(r).includes(token));
});
test('rejects arbitrary Netlify subdomain before sending bearer credential', async () => {
  let called = false;
  const r = await qualifyNetlifyHost({ ...base, endpoint: 'https://attacker.netlify.app/.netlify/functions/zoo-host-probe', fetchImpl: () => { called = true; } });
  assert.equal(r.status, 'BLOCKED'); assert.equal(r.reason, 'host_not_explicitly_allowlisted'); assert.equal(called, false);
});
test('fails closed when allowedHosts is omitted', async () => {
  let called = false;
  const r = await qualifyNetlifyHost({ ...base, allowedHosts: undefined, fetchImpl: () => { called = true; } });
  assert.equal(r.reason, 'host_not_explicitly_allowlisted'); assert.equal(called, false);
});
