import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql = readFileSync(new URL('../ops/relay/006_outbox_ack_lease_fence.sql', import.meta.url), 'utf8');
const body = sql.match(/CREATE OR REPLACE FUNCTION public\.zoo_ops_outbox_ack\(p_id bigint,p_token uuid\)[\s\S]*?END \$\$;/)?.[0];

test('outbox ACK override is atomic and limited to the private ops function', () => {
  assert.match(sql, /^BEGIN;\s/m);
  assert.match(sql, /COMMIT;\s*$/);
  assert.ok(body, 'expected exact ACK function signature');
  assert.doesNotMatch(sql, /CREATE OR REPLACE FUNCTION public\.zoo_ops_outbox_(?:claim|recover|settle_idle)/);
});

test('stale, mismatched and null leases cannot ACK a wake-up', () => {
  assert.match(body, /p_id IS NULL OR p_token IS NULL THEN RETURN false/);
  assert.match(body, /o\.id=p_id AND o\.state='leased' AND o\.lease_token=p_token/);
  assert.match(body, /o\.lease_until\s*>\s*clock_timestamp\(\)/);
  assert.match(body, /RETURN FOUND;/);
});

test('ACK remains service-role-only with a bounded search path', () => {
  assert.match(body, /SECURITY DEFINER SET search_path=public,pg_temp/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.zoo_ops_outbox_ack\(bigint,uuid\) FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.zoo_ops_outbox_ack\(bigint,uuid\) TO service_role/);
});

test('synthetic expired-claim race is fenced without changing a live ACK', () => {
  const ack = (row, id, token, now) => row.id===id && row.state==='leased' &&
    row.token===token && row.leaseUntil>now;
  const row={id:7,state:'leased',token:'old-token',leaseUntil:300};
  assert.equal(ack(row,7,'old-token',301),false);
  assert.equal(ack(row,7,'other-token',299),false);
  assert.equal(ack(row,7,'old-token',299),true);
  assert.equal(ack({...row,state:'pending'},7,'old-token',299),false);
});

test('long-running transaction cannot ACK using stale transaction-start time', () => {
  // PostgreSQL now() is fixed at transaction start, not wall-clock time.
  // The predicate must use the current clock after any lock wait.
  assert.match(body, /o\.lease_until\s*>\s*clock_timestamp\(\)/);
  assert.doesNotMatch(body, /o\.lease_until\s*>\s*now\(\)/);
  const leaseUntil=300, transactionStarted=299, wallClock=301;
  assert.equal(leaseUntil>transactionStarted,true, 'a stale now() would incorrectly accept');
  assert.equal(leaseUntil>wallClock,false, 'real wall clock must reject');
});
