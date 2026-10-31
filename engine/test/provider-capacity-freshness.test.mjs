import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProviderReceipt,capabilityCounts} from '../ops/hunter/provider-receipt.mjs';
const SHA='a'.repeat(40), ART='b'.repeat(40);
const receipt={schema:'zoo.provider-invocation.v1',provider:'deepseek',provider_kind:'model',model_id:'deepseek-reasoner',provider_request_id:'native-123',agent_id:'hunter',task_id:'T-100',role:'builder',source_sha:SHA,artifact_sha:ART,status:'completed',started_at:'2026-10-31T10:00:00Z',finished_at:'2026-10-31T10:00:03Z',evidence_url:'https://provider.example/requests/native-123',cost_usd:null};
const native={authenticated:true,provider:'deepseek',provider_kind:'model',model_id:'deepseek-reasoner',provider_request_id:'native-123',source_sha:SHA,artifact_sha:ART,status:'completed',evidence_url:'https://provider.example/requests/native-123'};
test('stale provider invocation cannot inflate live productive capacity',async()=>{
 const q=await assessProviderReceipt(receipt,{now:'2026-10-31T10:01:00Z',verifyProvider:async()=>native});
 assert.equal(q.qualified,true);
 assert.equal(capabilityCounts([q],{now:'2026-10-31T10:02:00Z'}).productive_invocations,1);
 assert.equal(capabilityCounts([q],{now:'2026-10-31T12:02:00Z'}).productive_invocations,0);
 assert.equal(capabilityCounts([q],{now:'2026-10-31T09:00:00Z'}).productive_invocations,0);
 assert.equal(capabilityCounts([q],{now:'not-a-time'}).productive_invocations,0);
 assert.equal(capabilityCounts([{...q}],{now:'2026-10-31T10:02:00Z'}).productive_invocations,0);
});
