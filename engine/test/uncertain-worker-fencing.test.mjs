import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../ops/relay/', import.meta.url);
const patch = readFileSync(new URL('003_uncertain_worker_fencing.sql', root), 'utf8');

// These tests validate the migration contract and a synthetic state model.
// They are NOT a PostgreSQL migration run or a hosted worker invocation.
test('migration fences leased and uncertain in both claim guard and unique index', () => {
  assert.match(patch, /CREATE UNIQUE INDEX IF NOT EXISTS zoo_ops_worker_active_uncertain_v1[\s\S]*?WHERE state IN \('leased','uncertain'\) AND lease_owner IS NOT NULL/);
  assert.match(patch, /WHERE q\.state IN \('leased','uncertain'\) AND q\.lease_owner=p_worker/);
});
test('migration preserves atomic preflight, claim ordering, dependency checks and service-only RPC', () => {
  assert.match(patch, /BEGIN;[\s\S]*LOCK TABLE public\.zoo_ops_tickets IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(patch, /GROUP BY lease_owner HAVING count\(\*\) > 1/);
  assert.match(patch, /pg_advisory_xact_lock/);
  assert.match(patch, /FOR UPDATE OF q SKIP LOCKED LIMIT 1/);
  assert.match(patch, /unnest\(q\.dependencies\)/);
  assert.match(patch, /REVOKE ALL ON FUNCTION public\.zoo_ops_claim\(text\) FROM PUBLIC,anon,authenticated/);
  assert.match(patch, /GRANT EXECUTE ON FUNCTION public\.zoo_ops_claim\(text\) TO service_role/);
  assert.match(patch, /COMMIT;/);
});
test('synthetic: quarantined uncertain worker cannot claim T2; independent worker can', () => {
  const tickets = [{id:'T1',state:'uncertain',lease_owner:'workerA'}, {id:'T2',state:'queued',lease_owner:null}];
  const claim = worker => {
    if (tickets.some(t => ['leased','uncertain'].includes(t.state) && t.lease_owner===worker)) return null;
    const ticket=tickets.find(t=>t.state==='queued');
    if (!ticket) return null;
    ticket.state='leased';ticket.lease_owner=worker;return ticket.id;
  };
  assert.equal(claim('workerA'),null);
  assert.equal(claim('workerB'),'T2');
  assert.equal(tickets[0].state,'uncertain');
  assert.equal(tickets[1].lease_owner,'workerB');
});
test('synthetic: authenticated not-started resolution releases worker for next claim', () => {
  const tickets = [{id:'T1',state:'uncertain',lease_owner:'workerA'}, {id:'T2',state:'queued',lease_owner:null}];
  const active=()=>tickets.some(t=>['leased','uncertain'].includes(t.state)&&t.lease_owner==='workerA');
  assert.equal(active(),true);
  // Models zoo_ops_not_started with a matching native non-execution receipt.
  tickets[0].state='queued';tickets[0].lease_owner=null;
  assert.equal(active(),false);
});
