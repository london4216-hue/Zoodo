import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql = readFileSync(new URL('../ops/relay/001_ticket_directory.sql', import.meta.url), 'utf8');
const dispatchMarker = 'CREATE OR REPLACE FUNCTION public.zoo_ops_dispatch_recorded';

test('SQL migration has one transaction and paired PL/pgSQL dollar quotes', () => {
  assert.equal((sql.match(/\bBEGIN;/g) ?? []).length, 1);
  assert.equal((sql.match(/\bCOMMIT;/g) ?? []).length, 1);
  assert.equal((sql.match(/\$\$/g) ?? []).length % 2, 0);
  assert.doesNotMatch(sql, /\bAS \$(?!\$)/);
  assert.match(sql, /END \$\$;\s*COMMIT;\s*$/);
});

test('dispatch_recorded RPC is intact, bound to the active lease and returns a receipt', () => {
  assert.equal(sql.split(dispatchMarker).length, 2);
  const tail = sql.slice(sql.indexOf(dispatchMarker));
  assert.match(tail, /AS \$\$\s*BEGIN/);
  assert.ok(tail.includes("IF p_receipt !~ '^https://[^ ]{1,1000}$'"));
  assert.ok(tail.includes("WHERE id=p_id AND state='leased' AND lease_owner=p_worker AND lease_token=p_token"));
  assert.ok(tail.includes("VALUES(p_id,'dispatch_accepted',p_worker,p_receipt)"));
  assert.match(tail, /RETURN true;\s*END \$\$;/);
});

test('function execution grants remain service-role-only', () => {
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated'));
  assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION %s TO service_role'));
});

test('regression fixture detects original broken SQL migration tail', () => {
  const broken = 'RETURNS boolean LANGUAGE plpgsql AS $\nBEGIN\nCOMMIT;\nCOMMIT;';
  assert.match(broken, /\bAS \$(?!\$)/);
  assert.equal((broken.match(/\bCOMMIT;/g) ?? []).length, 2);
});
