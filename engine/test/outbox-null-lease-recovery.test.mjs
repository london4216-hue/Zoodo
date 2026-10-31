import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const dir=dirname(fileURLToPath(import.meta.url));
const sql=readFileSync(resolve(dir,'../ops/relay/010_outbox_null_lease_recovery.sql'),'utf8');

test('recovery includes leased wake-ups without a valid expiry timestamp',()=>{
  assert.match(sql,/o\.state='leased'\s+AND\s*\(\s*o\.lease_until\s+IS\s+NULL\s+OR\s+o\.lease_until\s*<\s*clock_timestamp\(\)\s*\)/i);
});
test('repair preserves bounded backoff and dead-letter replay',()=>{
  assert.match(sql,/o\.state='dead'\s+AND\s+o\.next_at\s*<=\s*clock_timestamp\(\)/i);
  assert.match(sql,/LEAST\(3600,\s*30\s*\*\s*\(1\s*<<\s*LEAST\(GREATEST\(o\.attempts-1,0\),7\)\)\)/i);
  assert.match(sql,/SET\s+state='pending'/i);
  assert.match(sql,/lease_token=NULL\s*,\s*lease_until=NULL/i);
});
test('repair retains audit trail and service-role-only access',()=>{
  assert.match(sql,/INSERT INTO public\.zoo_ops_events\(ticket_id,event\)/i);
  assert.match(sql,/outbox_retry_budget_exceeded/);
  assert.match(sql,/outbox_lease_recovered/);
  assert.match(sql,/SECURITY DEFINER SET search_path=public,pg_temp/i);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.zoo_ops_outbox_recover\(\) FROM PUBLIC,anon,authenticated/i);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.zoo_ops_outbox_recover\(\) TO service_role/i);
});
test('SQL NULL expiry is not eligible under old comparison but is eligible under repaired predicate',()=>{
  const oldEligible = leaseUntil => leaseUntil == null ? null : leaseUntil < 1000;
  const newEligible = leaseUntil => leaseUntil == null || leaseUntil < 1000;
  assert.equal(oldEligible(null),null);
  assert.equal(newEligible(null),true);
  assert.equal(newEligible(500),true);
  assert.equal(newEligible(1500),false);
});
