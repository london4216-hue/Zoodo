import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAutomationProof} from '../automation-proof.mjs';
const now=Date.parse('2026-10-31T23:32:00Z');
const base={schema_version:1,source:'connected_automations_peek',observed_at:'2026-10-31T23:30:00Z',expected_roles:['ZOO Keeper'],workers:[{
 role:'ZOO Keeper',run_id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',recorded_status:'completed',
 scheduled_for:'2026-10-31T23:20:00Z',completed_at:'2026-10-31T23:25:00Z'}]};
const bad={role:'ZOO Keeper',kind:'completion_before_scheduled_for_or_invalid',
 run_id:'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',scheduled_for:'2026-10-31T23:40:00Z',completed_at:'2026-10-31T23:10:00Z'};
test('later valid same-role completion resolves anomaly with erroneous future scheduled_for',()=>{
 const r=evaluateAutomationProof({...base,source_anomalies:[bad]},now);
 assert.equal(r.state,'RECORDED RUNS CURRENT');
 assert.deepEqual(r.overdue,[]);
 assert.equal(r.activeWorkersVerified,false);
});
test('anomaly without trustworthy completion timestamp remains recovery',()=>{
 const r=evaluateAutomationProof({...base,source_anomalies:[{...bad,completed_at:'invalid'}]},now);
 assert.equal(r.state,'RECOVERY REQUIRED');
 assert.deepEqual(r.overdue,['ZOO Keeper']);
});
test('older valid completion cannot resolve newer anomalous completion',()=>{
 const r=evaluateAutomationProof({...base,source_anomalies:[{...bad,scheduled_for:'2026-10-31T23:45:00Z',completed_at:'2026-10-31T23:27:00Z'}]},now);
 assert.equal(r.state,'RECOVERY REQUIRED');
});
test('different role completion cannot resolve another role anomaly',()=>{
 const r=evaluateAutomationProof({...base,source_anomalies:[{...bad,role:'ZOO Agent Hunter'}]},now);
 assert.equal(r.state,'RECOVERY REQUIRED');
 assert.deepEqual(r.overdue,['ZOO Agent Hunter']);
});
