import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const sql = readFileSync(new URL('../ops/relay/002_outbox_idle_settlement.sql', import.meta.url),'utf8');
test('additive RPC matches the portable-relay store contract and is service-role only',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.zoo_ops_outbox_settle_idle\(p_id bigint, p_token uuid\)/);
 assert.match(sql,/RETURNS boolean/);
 assert.match(sql,/SECURITY DEFINER SET search_path=public,pg_temp/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.zoo_ops_outbox_settle_idle\(bigint,uuid\)[\s\S]*?FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.zoo_ops_outbox_settle_idle\(bigint,uuid\)[\s\S]*?TO service_role/);
});
test('idle ACK is atomic, lease-fenced and disallowed while runnable work remains',()=>{
 assert.match(sql,/UPDATE public\.zoo_ops_outbox AS o[\s\S]*?state='acked'/);
 for (const guard of [/o\.state='leased'/,/o\.lease_token=p_token/,/o\.lease_until>now\(\)/,/NOT EXISTS \([\s\S]*?q\.state='queued'/,/q\.attempts<q\.max_attempts/,/unnest\(q\.dependencies\)/,/d\.state<>'done'/]) assert.match(sql,guard);
});
