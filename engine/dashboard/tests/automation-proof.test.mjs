import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAutomationProof} from '../automation-proof.mjs';
const now=Date.parse('2026-10-30T16:30:00Z');
const good={schema_version:1,source:'connected_automations_peek',observed_at:'2026-10-30T16:25:00Z',
 workers:[{role:'ZOO Keeper',run_id:'60a78be7-d2f8-832f-a788-25876c50adc2',
 recorded_status:'completed',scheduled_for:'2026-10-30T16:00:00Z',completed_at:'2026-10-30T16:05:00Z'}]};
test('actual completed execution is not misrepresented as a live worker heartbeat',()=>{
 const p=evaluateAutomationProof(good,now);
 assert.equal(p.state,'RECORDED RUNS CURRENT');assert.equal(p.activeWorkersVerified,false);
 assert.equal(p.lastRunAt,'2026-10-30T16:05:00Z');
});
test('stale or absent worker evidence becomes an actionable recovery state',()=>{
 assert.equal(evaluateAutomationProof(good,now+80*60000).state,'RECOVERY REQUIRED');
 assert.equal(evaluateAutomationProof(null,now).state,'UNKNOWN');
});
test('page reload, fake active status and future timestamps do not refresh proof',()=>{
 assert.equal(evaluateAutomationProof({...good,workers:[{...good.workers[0],recorded_status:'in_progress'}]},now).state,'UNKNOWN');
 assert.equal(evaluateAutomationProof({...good,observed_at:'2026-11-01T00:00:00Z'},now).state,'UNKNOWN');
});
