import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../ops/relay/010_outbox_null_lease_recovery.sql',import.meta.url),'utf8');

test('outbox recovery audit timestamp uses actual event time rather than transaction start',()=>{
  const audit=sql.slice(sql.indexOf('INSERT INTO public.zoo_ops_events'));
  assert.match(audit,/INSERT INTO public\.zoo_ops_events\(ticket_id,event,at\)/);
  assert.match(audit,/END\s*,\s*clock_timestamp\(\)\s+FROM recovered/);
});
test('outbox recovery preserves bounded retry, NULL-lease recovery and service-role fence',()=>{
  assert.match(sql,/o\.lease_until IS NULL/);
  assert.match(sql,/LEAST\(3600,\s*30\s*\*/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.zoo_ops_outbox_recover\(\) FROM PUBLIC,anon,authenticated/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.zoo_ops_outbox_recover\(\) TO service_role/);
});
