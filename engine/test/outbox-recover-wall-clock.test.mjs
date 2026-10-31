import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = () => readFileSync(new URL('../ops/relay/008_outbox_recover_wall_clock.sql', import.meta.url), 'utf8');
test('outbox recovery uses wall clock for expired leases and dead wakeups, not transaction start',()=>{
  const sql=source();
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.zoo_ops_outbox_recover\(\)/);
  assert.match(sql,/o\.lease_until\s*<\s*clock_timestamp\(\)/);
  assert.match(sql,/o\.next_at\s*<=\s*clock_timestamp\(\)/);
  assert.match(sql,/next_at\s*=\s*clock_timestamp\(\)\s*\+/);
  assert.doesNotMatch(sql,/o\.(?:lease_until|next_at)\s*(?:<|<=)\s*now\(\)/);
});
test('wall-clock recovery preserves capped retry, durable audit and service-role-only boundary',()=>{
  const sql=source();
  assert.match(sql,/LEAST\s*\(\s*3600\s*,\s*30\s*\*/);
  assert.match(sql,/INSERT INTO public\.zoo_ops_events/);
  assert.match(sql,/outbox_retry_budget_exceeded/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.zoo_ops_outbox_recover\(\) FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.zoo_ops_outbox_recover\(\) TO service_role/);
});
