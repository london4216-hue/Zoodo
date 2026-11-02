import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const sql = readFileSync(fileURLToPath(new URL('../ops/relay/009_outbox_claim_wall_clock.sql', import.meta.url)), 'utf8');
const functionBody = sql.match(/CREATE OR REPLACE FUNCTION public\.zoo_ops_outbox_claim\(\)([\s\S]*?)END \$\$;/i)?.[1];

test('claim migration overrides the existing outbox RPC without replacing the table', () => {
  assert.ok(functionBody, 'expected full outbox claim replacement');
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/);
  assert.doesNotMatch(sql, /CREATE TABLE|DROP TABLE|TRUNCATE/i);
});

test('eligibility and newly granted lease use actual clock, not transaction-start now()', () => {
  assert.match(functionBody, /next_at\s*<=\s*clock_timestamp\(\)/i);
  assert.match(functionBody, /lease_until\s*=\s*clock_timestamp\(\)\s*\+\s*interval\s*'30 seconds'/i);
  assert.doesNotMatch(functionBody, /\bnow\s*\(/i);
});

test('claim retains one-row skip-locked atomic selection and a token', () => {
  assert.match(functionBody, /FOR UPDATE OF x SKIP LOCKED LIMIT 1/i);
  assert.match(functionBody, /gen_random_uuid\(\)/i);
  assert.match(functionBody, /attempts\s*=\s*x\.attempts\s*\+\s*1/i);
  assert.match(functionBody, /RETURN QUERY SELECT o\.id,o\.ticket_id,o\.lease_token/i);
});

test('RPC remains service-role only', () => {
  assert.match(sql, /SECURITY DEFINER SET search_path=public,pg_temp/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.zoo_ops_outbox_claim\(\) FROM PUBLIC,anon,authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.zoo_ops_outbox_claim\(\) TO service_role/i);
});
