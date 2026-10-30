import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql = readFileSync(new URL('../ops/relay/001_ticket_directory.sql', import.meta.url), 'utf8');
const count = (pattern) => [...sql.matchAll(pattern)].length;

test('Supabase migration is one balanced transaction with complete dollar quotes', () => {
  assert.equal(count(/\\bBEGIN;/g), 1, 'one outer transaction');
  assert.equal(count(/\\bCOMMIT;/g), 1, 'one final commit');
  assert.equal(count(/\\$\\$/g) % 2, 0, 'balanced PostgreSQL dollar-quoted bodies');
  assert.doesNotMatch(sql, /\\bAS \\$\\s*\\n/, 'no untagged single-dollar function body');
  assert.doesNotMatch(sql, /END \\$;/, 'no malformed function end');
});

test('dispatch receipt RPC has an intact function body and fenced lease update', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\\.zoo_ops_dispatch_recorded\\([\\s\\S]*?AS \\$\\$[\\s\\S]*?END \\$\\$;/);
  const section = sql.split('CREATE OR REPLACE FUNCTION public.zoo_ops_dispatch_recorded(')[1]?.split('END $$;')[0];
  assert.ok(section, 'dispatch RPC present');
  assert.match(section, /p_receipt !~ '\\^https:\\/\\//);
  assert.match(section, /state='leased' AND lease_owner=p_worker AND lease_token=p_token/);
  assert.match(section, /INSERT INTO public\\.zoo_ops_events/);
});

test('migration revokes public RPC execution and retains service role access', () => {
  assert.match(sql, /DO \\$\\$ DECLARE signature text; BEGIN/);
  assert.match(sql, /REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION %s TO service_role/);
  assert.ok(sql.trimEnd().endsWith('COMMIT;'), 'grants included in transaction');
});
