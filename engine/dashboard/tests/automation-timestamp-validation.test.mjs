import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAutomationProof} from '../automation-proof.mjs';

const now=Date.parse('2026-03-02T12:06:00Z');
const receipt={
 schema_version:1,source:'connected_automations_peek',
 observed_at:'2026-03-02T12:05:00Z',
 expected_roles:['ZOO Keeper'],
 workers:[{
  role:'ZOO Keeper',run_id:'b1894202-0aa4-8321-bd04-b3e89d4ff3de',
  recorded_status:'completed',scheduled_for:'2026-03-02T11:59:00Z',
  completed_at:'2026-03-02T12:00:00Z'
 }]
};
const check=changes=>evaluateAutomationProof({
 ...receipt,...changes,
 workers:changes?.workers??receipt.workers
},now);
test('accepts authentic RFC3339 UTC scheduler receipt',()=>{
 assert.equal(check({}).state,'RECORDED RUNS CURRENT');
});
test('rejects non-timestamp string that Date.parse accepts',()=>{
 assert.equal(check({observed_at:'0'}).state,'UNKNOWN');
});
test('rejects nonexistent observed calendar day',()=>{
 assert.equal(check({observed_at:'2026-02-30T12:05:00Z'}).state,'UNKNOWN');
});
test('rejects nonexistent completion calendar day',()=>{
 assert.equal(check({workers:[{...receipt.workers[0],completed_at:'2026-02-30T12:00:00Z'}]}).state,'UNKNOWN');
});
test('rejects nonexistent scheduled calendar day',()=>{
 assert.equal(check({workers:[{...receipt.workers[0],scheduled_for:'2026-02-30T11:59:00Z'}]}).state,'UNKNOWN');
});
test('accepts microsecond timestamps and UTC offset',()=>{
 const f={
  ...receipt,observed_at:'2026-03-02T08:05:00-04:00',
  workers:[{...receipt.workers[0],scheduled_for:'2026-03-02T11:59:00.123456Z',
   completed_at:'2026-03-02T08:00:00-04:00'}]
 };
 assert.equal(evaluateAutomationProof(f,now).state,'RECORDED RUNS CURRENT');
});
test('accepts leap-day timestamp in a leap year',()=>{
 const f={
  ...receipt,observed_at:'2024-02-29T12:05:00Z',
  workers:[{...receipt.workers[0],scheduled_for:'2024-02-29T11:59:00Z',
   completed_at:'2024-02-29T12:00:00Z'}]
 };
 assert.equal(evaluateAutomationProof(f,Date.parse('2024-02-29T12:06:00Z')).state,'RECORDED RUNS CURRENT');
});
test('rejects offset beyond RFC3339 14 hours',()=>{
 assert.equal(check({observed_at:'2026-03-02T12:05:00+14:01'}).state,'UNKNOWN');
});
