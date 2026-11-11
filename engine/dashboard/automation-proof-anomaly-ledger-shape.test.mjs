import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAutomationProof } from './automation-proof.mjs';

const NOW=Date.parse('2026-11-01T01:30:00Z');
function feed(extra={}) {
 return {
  schema_version:1,
  source:'connected_automations_peek',
  observed_at:'2026-11-01T01:25:00Z',
  expected_roles:['ZOO Keeper'],
  workers:[{
   role:'ZOO Keeper',
   run_id:'4101ba7d-a000-832f-96a6-a501c6e46481',
   recorded_status:'completed',
   scheduled_for:'2026-11-01T01:19:00Z',
   completed_at:'2026-11-01T01:20:00Z'
  }],
  ...extra
 };
}
const cases=[
 ['optional anomaly ledger omitted',{},'RECORDED RUNS CURRENT'],
 ['empty anomaly ledger',{source_anomalies:[]},'RECORDED RUNS CURRENT'],
 ['object ledger is malformed',{source_anomalies:{kind:'clock-skew'}},'UNKNOWN'],
 ['null ledger is malformed',{source_anomalies:null},'UNKNOWN'],
 ['string ledger is malformed',{source_anomalies:'corrupt'},'UNKNOWN'],
 ['number ledger is malformed',{source_anomalies:3},'UNKNOWN'],
 ['unresolved anomaly stays in recovery',{source_anomalies:[{role:'ZOO Keeper',scheduled_for:'2026-11-01T01:22:00Z'}]},'RECOVERY REQUIRED'],
 ['resolved anomaly does not remain overdue',{source_anomalies:[{role:'ZOO Keeper',scheduled_for:'2026-11-01T01:19:30Z'}]},'RECORDED RUNS CURRENT']
];
for(const [name,extra,expected] of cases){
 test(name,()=>assert.equal(evaluateAutomationProof(feed(extra),NOW).state,expected));
}
