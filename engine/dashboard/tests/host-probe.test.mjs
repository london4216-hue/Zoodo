import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { makeHostProbe } from '../netlify/functions/zoo-host-probe.mjs';
const token = 'zoo-host-probe-synthetic-token-for-tests-only-12345';
const nonce = 'synthetic_probe_20261030';
const base = { httpMethod: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ task: 'synthetic-hash', nonce }) };
const make = (options = {}) => makeHostProbe({ token, commitRef: 'a'.repeat(40), clock: () => new Date('2026-10-31T02:00:00Z'), id: () => 'test-invocation-id', ...options });
const run = async (handler, request) => { const response = await handler(request); return { ...response, payload: JSON.parse(response.body) }; };

test('unconfigured provider fails closed', async () => {
  const r = await run(makeHostProbe(), base);
  assert.equal(r.statusCode, 503); assert.equal(r.payload.error, 'probe_not_configured');
});
test('only POST accepted', async () => {
  const r = await run(make(), { ...base, httpMethod: 'GET' }); assert.equal(r.statusCode, 405);
});
test('missing and wrong bearer credentials rejected', async () => {
  for (const authorization of [undefined, 'Bearer incorrect']) {
    const r = await run(make(), { ...base, headers: { authorization } }); assert.equal(r.statusCode, 401);
  }
});
test('malformed and oversized requests rejected', async () => {
  assert.equal((await run(make(), { ...base, body: '{' })).statusCode, 400);
  assert.equal((await run(make(), { ...base, body: 'x'.repeat(1025) })).statusCode, 413);
});
test('only bounded synthetic tasks allowed', async () => {
  for (const payload of [{ task: 'execute-ticket', nonce }, { task: 'synthetic-hash', nonce: 'short' }]) {
    assert.equal((await run(make(), { ...base, body: JSON.stringify(payload) })).statusCode, 422);
  }
});
test('successful synthetic execution returns attributable bounded receipt', async () => {
  const r = await run(make(), base);
  assert.equal(r.statusCode, 200);
  assert.equal(r.payload.invocation_id, 'test-invocation-id');
  assert.equal(r.payload.source_commit_sha, 'a'.repeat(40));
  assert.equal(r.payload.provider_runtime, 'netlify-functions-node');
  assert.equal(r.payload.output_sha256, createHash('sha256').update(`zoo-host-probe-v1:${nonce}`).digest('hex'));
  assert.equal(r.payload.durable_queue_verified, false);
  assert.equal(r.payload.external_ai_invoked, false);
  assert.equal(r.headers['cache-control'], 'no-store');
});
test('unknown source SHA is not fabricated', async () => {
  const r = await run(make({ commitRef: 'unavailable' }), base);
  assert.equal(r.payload.source_commit_sha, null);
});
