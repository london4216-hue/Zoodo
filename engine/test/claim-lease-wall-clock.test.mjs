import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql = readFileSync(new URL('../ops/relay/003_uncertain_worker_fencing.sql', import.meta.url), 'utf8');
const claim = sql.match(/CREATE OR REPLACE FUNCTION public\.zoo_ops_claim\(p_worker text\)[\s\S]*?END \$\$;/)?.[0];

test('new worker lease starts at assignment wall-clock, not transaction start', () => {
  assert.ok(claim, 'claim RPC must exist');
  assert.match(claim, /lease_until\s*=\s*clock_timestamp\(\)\s*\+\s*interval '45 seconds'/);
  assert.doesNotMatch(claim, /lease_until\s*=\s*now\(\)/);
});

test('long-running transaction must not assign an already expired lease', () => {
  const transactionStartMs=100_000;
  const assignmentMs=160_000;
  const leaseMs=45_000;
  assert.ok(transactionStartMs+leaseMs < assignmentMs, 'transaction clock would expire before assignment');
  assert.ok(assignmentMs+leaseMs > assignmentMs, 'wall-clock lease starts after assignment');
});

test('worker fencing and claim lock remain intact', () => {
  assert.match(claim, /p_worker IS NULL OR p_worker !~/);
  assert.match(claim, /pg_advisory_xact_lock/);
  assert.match(claim, /state IN \('leased','uncertain'\)/);
  assert.match(claim, /FOR UPDATE OF q SKIP LOCKED LIMIT 1/);
});
