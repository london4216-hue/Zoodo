import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProviderReceipt,capabilityCounts} from '../ops/hunter/provider-receipt.mjs';

const SHA='a'.repeat(40), ART='b'.repeat(40);
const receipt={
 schema:'zoo.provider-invocation.v1',provider:'deepseek',provider_kind:'model',model_id:'deepseek-reasoner',
 provider_request_id:'native-future-123',agent_id:'hunter',task_id:'T-future',role:'builder',
 source_sha:SHA,artifact_sha:ART,status:'completed',
 started_at:'2026-10-31T10:01:10Z',finished_at:'2026-10-31T10:01:20Z',
 evidence_url:'https://provider.example/requests/native-future-123',cost_usd:null
};
const native={authenticated:true,provider:receipt.provider,provider_kind:receipt.provider_kind,
 model_id:receipt.model_id,provider_request_id:receipt.provider_request_id,
 source_sha:SHA,artifact_sha:ART,status:'completed',evidence_url:receipt.evidence_url};

test('a qualified future-finished receipt is not counted as already completed',async()=>{
 const q=await assessProviderReceipt(receipt,{
  now:'2026-10-31T10:01:00Z',expectedTaskId:receipt.task_id,
  expectedAgentId:receipt.agent_id,expectedRole:receipt.role,expectedSourceSha:SHA,
  verifyProvider:async()=>native
 });
 assert.equal(q.qualified,true,'30-second clock tolerance at assessment remains unchanged');
 assert.equal(capabilityCounts([q],{now:'2026-10-31T10:01:00Z'}).productive_invocations,0,
  'a finish timestamp in the future cannot be productive now');
 assert.equal(capabilityCounts([q],{now:'2026-10-31T10:01:19Z'}).productive_invocations,0);
 assert.equal(capabilityCounts([q],{now:'2026-10-31T10:01:20Z'}).productive_invocations,1);
 assert.equal(capabilityCounts([q],{now:'2026-10-31T10:02:00Z'}).roles.builder,1);
 assert.equal(capabilityCounts([q],{now:'2026-10-31T11:02:00Z'}).productive_invocations,0);
});
