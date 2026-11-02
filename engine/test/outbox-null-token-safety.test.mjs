import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../ops/relay/010_outbox_null_lease_recovery.sql', import.meta.url), 'utf8');

// Source-contract and predicate-model checks, NOT PostgreSQL execution.
test('NULL-expiry recovery is fenced when a worker lease token is still present', () => {
  assert.match(sql, /o\.state='leased'\s+AND\s*\(o\.lease_until IS NULL OR o\.lease_until<clock_timestamp\(\)\)\s+AND\s*\(o\.lease_until IS NOT NULL OR o\.lease_token IS NULL\)/);
});

test('token-bearing unknown-expiry work remains quarantined while safe legacy work can recover', () => {
  const eligible = (state, leaseUntil, leaseToken, now = 1000) =>
    state === 'leased' && (leaseUntil == null || leaseUntil < now) &&
    (leaseUntil != null || leaseToken == null);
  assert.equal(eligible('leased', null, 'live-token'), false);
  assert.equal(eligible('leased', null, null), true);
  assert.equal(eligible('leased', 500, 'expired-token'), true);
  assert.equal(eligible('leased', 1500, 'live-token'), false);
  assert.equal(eligible('pending', null, null), false);
});

test('backoff, event audit, and service-role access remain intact', () => {
  assert.match(sql, /LEAST\(3600, 30 \* \(1 << LEAST\(GREATEST\(o\.attempts-1,0\),7\)\)\)/);
  assert.match(sql, /INSERT INTO public\.zoo_ops_events\(ticket_id,event,at\)/);
  assert.match(sql, /clock_timestamp\(\)\s+FROM recovered/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.zoo_ops_outbox_recover\(\) TO service_role/);
});
