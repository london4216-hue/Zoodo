import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enforceManifest, enforceAll } from '../ops/manifest-enforcement.mjs';

test('rejects missing manifest', () => {
  const r = enforceManifest(null);
  assert.equal(r.ok, false);
});

test('rejects future timestamp', () => {
  const r = enforceManifest({ agent_id: 'a', timestamp: new Date(Date.now() + 120000).toISOString(), action: 'x', evidence_hash: 'abcdef12' });
  assert.equal(r.ok, false);
});

test('accepts recent valid manifest', () => {
  const r = enforceManifest({ agent_id: 'a', timestamp: new Date().toISOString(), action: 'audit', evidence_hash: 'abcdef12' });
  assert.equal(r.ok, true);
});

test('rejects stale (>7d)', () => {
  const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const r = enforceManifest({ agent_id: 'a', timestamp: old, action: 'audit', evidence_hash: 'abcdef12' });
  assert.equal(r.ok, false);
});

test('enforceAll aggregates', () => {
  const good = { agent_id: 'g', timestamp: new Date().toISOString(), action: 'x', evidence_hash: 'abcdef12' };
  const bad = { agent_id: 'b', timestamp: 'not-a-date', action: 'x', evidence_hash: 'abcdef12' };
  const r = enforceAll([good, bad]);
  assert.equal(r.ok, false);
  assert.equal(r.failed, 1);
});
