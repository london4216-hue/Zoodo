import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = () => readFileSync(new URL('../ops/relay/005_outbox_retry_backoff.sql', import.meta.url), 'utf8');

test('expired leases are requeued with bounded backoff instead of terminal dead-letter', () => {
  const sql = source();
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.zoo_ops_outbox_recover\(\)/);
  assert.match(sql, /state\s*=\s*'pending'/);
  assert.match(sql, /o\.state\s*=\s*'leased'\s+AND\s+o\.lease_until\s*<\s*now\(\)/);
  assert.match(sql, /o\.state\s*=\s*'dead'\s+AND\s+o\.next_at\s*<=\s*now\(\)/);
  assert.match(sql, /LEAST\s*\(\s*3600\s*,\s*30\s*\*/);
  assert.doesNotMatch(sql, /SET\s+state\s*=\s*CASE\s+WHEN\s+attempts\s*>=\s*4\s+THEN\s+'dead'/);
});

test('recovery leaves an auditable receipt and preserves service-role-only execution', () => {
  const sql = source();
  assert.match(sql, /INSERT INTO public\.zoo_ops_events/);
  assert.match(sql, /outbox_retry_budget_exceeded/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.zoo_ops_outbox_recover\(\) FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.zoo_ops_outbox_recover\(\) TO service_role/);
});
