import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSourceIdentity} from '../source-identity.mjs';
const base='autonomous-engine-replacement-2026-10-29';
const good={schema_version:1,build_tests:'PASSED',source_commit:'a'.repeat(40),branch:'fix/zoo-live-dashboard-accountability-20261030'};
test('exact provider build SHA selected for commit evidence, branch for Actions',()=>{
 const x=selectSourceIdentity(good,base);assert.equal(x.ref,'a'.repeat(40));assert.equal(x.branch,good.branch);assert.equal(x.providerBuildClaim,true);
});
test('absent receipt falls back without implying deployed source',()=>{
 const x=selectSourceIdentity(null,base);assert.equal(x.ref,base);assert.equal(x.sourceCommit,null);assert.equal(x.providerBuildClaim,false);
});
test('missing SHA, failed tests or unknown branch never claim build source',()=>{
 for(const x of [{...good,source_commit:null},{...good,build_tests:'FAILED'},{...good,branch:'unknown'},{...good,branch:'../secret'}]){
  assert.equal(selectSourceIdentity(x,base).providerBuildClaim,false);
 }
});
test('malformed fallback is rejected rather than used in API queries',()=>{
 assert.throws(()=>selectSourceIdentity(null,'../bad'));
});
