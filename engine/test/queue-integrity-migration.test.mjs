import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql = readFileSync(new URL('../ops/relay/004_queue_integrity_constraints.sql', import.meta.url), 'utf8');

// Source-contract tests only. PostgreSQL execution is a separate required gate.
test('migration is atomic and scoped to ZOO operations tables', () => {
  assert.match(sql, /^BEGIN;\s/m);
  assert.match(sql, /COMMIT;\s*$/);
  assert.match(sql, /LOCK TABLE public\.zoo_ops_tickets/);
  assert.doesNotMatch(sql, /(?:transendiq|beautypath|wonup)\./i);
});
test('leased and uncertain tickets require an attributable worker and fencing token', () => {
  assert.match(sql, /zoo_ops_active_lease_integrity_v1/);
  assert.match(sql, /state NOT IN \('leased','uncertain'\)/);
  assert.match(sql, /lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_until IS NOT NULL/);
});
test('completed tickets cannot have null or malformed SHA and test receipt', () => {
  assert.match(sql, /zoo_ops_done_evidence_integrity_v1/);
  assert.match(sql, /state <> 'done'/);
  assert.match(sql, /commit_sha IS NOT NULL AND commit_sha ~ '\^\[a-f0-9\]\{40\}\$'/);
  assert.match(sql, /test_url IS NOT NULL AND test_url ~ '\^https:\/\//);
});
test('native completion, dispatch and non-execution events cannot omit evidence', () => {
  assert.match(sql, /zoo_ops_event_receipt_integrity_v1/);
  assert.match(sql, /event NOT IN \('completed','not_started','dispatch_accepted'\)/);
  assert.match(sql, /receipt_url IS NOT NULL AND receipt_url ~ '\^https:\/\//);
});
test('leased outbox events require fencing token and expiry', () => {
  assert.match(sql, /zoo_ops_outbox_lease_integrity_v1/);
  assert.match(sql, /state <> 'leased'/);
  assert.match(sql, /lease_token IS NOT NULL AND lease_until IS NOT NULL/);
});
