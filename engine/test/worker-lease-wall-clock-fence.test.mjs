import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=()=>readFileSync(new URL('../ops/relay/004a_worker_lease_wall_clock_fence.sql',import.meta.url),'utf8');
const body=(name)=>{const s=sql();const start=s.indexOf(`FUNCTION public.${name}(`);assert.ok(start>=0,`missing ${name}`);const next=s.indexOf('END $$;',start);assert.ok(next>start,`incomplete ${name}`);return s.slice(start,next)};
test('completion rejects expired leases using wall clock after row lock',()=>{const s=body('zoo_ops_complete');assert.match(s,/state='leased'/);assert.match(s,/lease_owner=p_worker/);assert.match(s,/lease_token=p_token/);assert.match(s,/lease_until\s*>\s*clock_timestamp\(\)/);});
test('dispatch receipt cannot be attached to expired worker lease',()=>{const s=body('zoo_ops_dispatch_recorded');assert.match(s,/lease_token=p_token/);assert.match(s,/lease_until\s*>\s*clock_timestamp\(\)/);});
test('quarantine sees actual elapsed time, not transaction-start time',()=>{const s=body('zoo_ops_quarantine_expired');assert.match(s,/lease_until\s*<\s*clock_timestamp\(\)/);});
test('completion and dispatch reject NULL evidence before updating rows',()=>{assert.match(body('zoo_ops_complete'),/p_commit IS NULL/);assert.match(body('zoo_ops_complete'),/p_test_url IS NULL/);assert.match(body('zoo_ops_dispatch_recorded'),/p_receipt IS NULL/);});
