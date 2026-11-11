import test from 'node:test';
import assert from 'node:assert/strict';
import {assessProviderReceipt,capabilityCounts} from '../ops/hunter/provider-receipt.mjs';
const SHA='a'.repeat(40),ART='b'.repeat(40);
const receipt=()=>({schema:'zoo.provider-invocation.v1',provider:'gemini',provider_kind:'model',model_id:'gemini-3',provider_request_id:'native-123',agent_id:'agent-1',task_id:'ticket-A',role:'builder',source_sha:SHA,artifact_sha:ART,status:'completed',started_at:'2026-10-31T10:00:00Z',finished_at:'2026-10-31T10:00:03Z',evidence_url:'https://provider.example/requests/native-123',cost_usd:null});
const native=()=>({authenticated:true,provider:'gemini',provider_kind:'model',model_id:'gemini-3',provider_request_id:'native-123',source_sha:SHA,artifact_sha:ART,status:'completed',evidence_url:'https://provider.example/requests/native-123'});
const context={now:'2026-10-31T10:01:00Z',expectedTaskId:'ticket-A',expectedAgentId:'agent-1',expectedRole:'builder',expectedSourceSha:SHA,verifyProvider:async()=>native()};
test('native readback alone cannot establish an unbound task/agent/role',async()=>{
 for(const missing of ['expectedTaskId','expectedAgentId','expectedRole','expectedSourceSha']){
  const options={...context};delete options[missing];
  const result=await assessProviderReceipt(receipt(),options);
  assert.equal(result.qualified,false,`missing ${missing} must fail closed`);
  assert.equal(capabilityCounts([result],{now:context.now}).productive_invocations,0);
 }
});
test('a forged role, agent or task cannot inherit a valid native request receipt',async()=>{
 for(const patch of [{role:'judge'},{agent_id:'agent-2'},{task_id:'ticket-B'},{source_sha:'c'.repeat(40)}]){
  const result=await assessProviderReceipt({...receipt(),...patch},context);
  assert.equal(result.qualified,false,JSON.stringify(patch));
 }
});
test('exact trusted assignment and native readback qualify once',async()=>{
 const result=await assessProviderReceipt(receipt(),context);
 assert.equal(result.state,'QUALIFIED');
 assert.equal(capabilityCounts([result,result],{now:context.now}).productive_invocations,1);
 assert.equal(capabilityCounts([result],{now:context.now}).roles.builder,1);
});
