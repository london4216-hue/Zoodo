import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAutomationProof} from '../automation-proof.mjs';

const now=Date.parse('2026-11-01T00:40:00Z');
const worker={
 role:'ZOO Agent Hunter',run_id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
 recorded_status:'completed',scheduled_for:'2026-11-01T00:32:00Z',
 completed_at:'2026-11-01T00:35:00Z',enabled:false
};
const feed={
 schema_version:1,source:'connected_automations_peek',
 observed_at:'2026-11-01T00:38:00Z',
 expected_roles:['ZOO Agent Hunter'],workers:[worker]
};
const evaluate=changes=>evaluateAutomationProof({...feed,...changes},now);

test('disabled worker cannot claim current scheduler coverage with a recent completion',()=>{
 const result=evaluate({});
 assert.equal(result.state,'RECOVERY REQUIRED');
 assert.deepEqual(result.overdue,['ZOO Agent Hunter']);
 assert.equal(result.workerCount,1); // historical completion retained, not productive proof
 assert.equal(result.activeWorkersVerified,false);
});
test('enabled worker retains current recorded scheduler status',()=>{
 const result=evaluate({workers:[{...worker,enabled:true}]});
 assert.equal(result.state,'RECORDED RUNS CURRENT');
 assert.deepEqual(result.overdue,[]);
});
test('older snapshots without enabled property remain backward compatible',()=>{
 const {enabled,...legacy}=worker;
 assert.equal(evaluate({workers:[legacy]}).state,'RECORDED RUNS CURRENT');
});
test('disabled stale worker appears once in overdue list',()=>{
 const result=evaluate({workers:[{...worker,scheduled_for:'2026-10-31T23:00:00Z',completed_at:'2026-10-31T23:10:00Z'}]});
 assert.equal(result.state,'RECOVERY REQUIRED');
 assert.deepEqual(result.overdue,['ZOO Agent Hunter']);
});
test('mixed roster flags disabled role without claiming active worker proof',()=>{
 const keeper={...worker,role:'ZOO Keeper',run_id:'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff',enabled:true};
 const result=evaluate({expected_roles:['ZOO Agent Hunter','ZOO Keeper'],workers:[worker,keeper]});
 assert.equal(result.state,'RECOVERY REQUIRED');
 assert.deepEqual(result.overdue,['ZOO Agent Hunter']);
 assert.equal(result.activeWorkersVerified,false);
});
test('malformed disabled-worker identity still fails closed',()=>{
 const result=evaluate({workers:[{...worker,run_id:'bad'}]});
 assert.equal(result.state,'UNKNOWN');
 assert.equal(result.workerCount,0);
});
