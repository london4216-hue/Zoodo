import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const baseline = readFileSync(new URL('../ops/relay/002_outbox_idle_settlement.sql', import.meta.url),'utf8');
const fix = readFileSync(new URL('../ops/relay/007_outbox_idle_ack_wall_clock.sql', import.meta.url),'utf8');
const body = fix.match(/CREATE OR REPLACE FUNCTION public\.zoo_ops_outbox_settle_idle\(p_id bigint, p_token uuid\)[\s\S]*?END \$\$;/)?.[0];
test('regression: original idle ACK used transaction-start now()',()=>{
  assert.match(baseline,/o\.lease_until>now\(\)/);
});
test('replacement function is atomic and fences actual wall-clock lease expiry',()=>{
  assert.ok(body);
  assert.match(body,/o\.id=p_id AND o\.state='leased' AND o\.lease_token=p_token/);
  assert.match(body,/o\.lease_until>clock_timestamp\(\)/);
  assert.doesNotMatch(body,/o\.lease_until>now\(\)/);
  assert.match(body,/RETURN FOUND;/);
});
test('idle ACK still refuses when a runnable ticket exists, including dependency checks',()=>{
  assert.match(body,/AND NOT EXISTS \([\s\S]*?FROM public\.zoo_ops_tickets AS q/);
  assert.match(body,/q\.state='queued' AND q\.attempts<q\.max_attempts/);
  assert.match(body,/unnest\(q\.dependencies\)/);
  assert.match(body,/d\.id IS NULL OR d\.state<>'done'/);
});
test('service-role-only execution and bounded SECURITY DEFINER search path retained',()=>{
  assert.match(body,/SECURITY DEFINER SET search_path=public,pg_temp/);
  assert.match(fix,/REVOKE ALL ON FUNCTION public\.zoo_ops_outbox_settle_idle\(bigint,uuid\)[\s\S]*?FROM PUBLIC,anon,authenticated/);
  assert.match(fix,/GRANT EXECUTE ON FUNCTION public\.zoo_ops_outbox_settle_idle\(bigint,uuid\)[\s\S]*?TO service_role/);
});
test('single replacement function inside transaction, with no extra schema mutations',()=>{
  assert.equal((fix.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,1);
  assert.match(fix,/^BEGIN;\s/m);
  assert.match(fix,/COMMIT;\s*$/);
  assert.doesNotMatch(fix,/\b(?:CREATE TABLE|DROP TABLE|ALTER TABLE)\b/);
});
test('synthetic long transaction rejects stale idle ACK after lease expiry',()=>{
  const leaseUntil=300, transactionStarted=299, wallClockAfterLock=301;
  assert.equal(leaseUntil>transactionStarted,true);
  assert.equal(leaseUntil>wallClockAfterLock,false);
  const mayAck=({id,state,token,leaseUntil},request,now,runnable)=>id===request.id && state==='leased' && token===request.token && leaseUntil>now && !runnable;
  const row={id:7,state:'leased',token:'lease-A',leaseUntil};
  assert.equal(mayAck(row,{id:7,token:'lease-A'},wallClockAfterLock,false),false);
  assert.equal(mayAck(row,{id:7,token:'lease-A'},299,true),false);
  assert.equal(mayAck(row,{id:7,token:'lease-A'},299,false),true);
});
