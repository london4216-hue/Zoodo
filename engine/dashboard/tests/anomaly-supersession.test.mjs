import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateAutomationProof} from '../automation-proof.mjs';

const now=Date.parse('2026-10-31T10:47:00Z');
const valid={
 schema_version:1,source:'connected_automations_peek',
 observed_at:'2026-10-31T10:46:40Z',
 expected_roles:['ZOO Dashboard Worker'],
 workers:[{
  role:'ZOO Dashboard Worker',
  run_id:'0221e5a5-f940-832e-a5f8-187540f744b7',
  recorded_status:'completed',
  scheduled_for:'2026-10-31T10:39:30Z',
  completed_at:'2026-10-31T10:42:50Z'
 }]
};

test('pre-scheduled anomaly superseded by a later genuine completion is audit-only',()=>{
 const feed={...valid,source_anomalies:[{
  role:'ZOO Dashboard Worker',kind:'completion_before_scheduled_for_or_invalid',
  run_id:'d460f77b-3ba0-8323-9cb5-94232ae4348b',
  scheduled_for:'2026-10-31T10:45:58Z',completed_at:'2026-10-31T10:34:59Z'
 }]};
 const proof=evaluateAutomationProof(feed,now);
 assert.equal(proof.state,'RECORDED RUNS CURRENT');
 assert.deepEqual(proof.overdue,[]);
 assert.equal(proof.activeWorkersVerified,false);
});

test('anomaly newer than last valid completion remains a recovery event',()=>{
 const feed={...valid,source_anomalies:[{
  role:'ZOO Dashboard Worker',kind:'completion_before_scheduled_for_or_invalid',
  run_id:'d460f77b-3ba0-8323-9cb5-94232ae4348b',
  scheduled_for:'2026-10-31T10:50:00Z',completed_at:'2026-10-31T10:44:00Z'
 }]};
 assert.equal(evaluateAutomationProof(feed,now).state,'RECOVERY REQUIRED');
});

test('anomaly without a trustworthy completion timestamp remains unresolved',()=>{
 const feed={...valid,source_anomalies:[{
  role:'ZOO Dashboard Worker',kind:'invalid_completion_timestamp',
  scheduled_for:'2026-10-31T10:45:58Z'
 }]};
 assert.equal(evaluateAutomationProof(feed,now).state,'RECOVERY REQUIRED');
});
