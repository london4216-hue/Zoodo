import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql = readFileSync(new URL('../ops/relay/003_uncertain_worker_fencing.sql', import.meta.url), 'utf8');
test('migration has one complete worker regex guard, one function, and no SQL after commit', () => {
  assert.match(sql, /IF p_worker IS NULL OR p_worker !~ '\^\[A-Za-z0-9_-\]\{1,64\}\$' THEN RAISE EXCEPTION 'invalid worker'; END IF;/);
  assert.equal((sql.match(/CREATE OR REPLACE FUNCTION public\.zoo_ops_claim\(/g) ?? []).length, 1);
  assert.equal((sql.match(/\bCOMMIT;/g) ?? []).length, 1);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.zoo_ops_claim\(text\) TO service_role;\s*COMMIT;\s*$/);
});
