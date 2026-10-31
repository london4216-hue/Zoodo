import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateEvidence} from '../evidence-clock.mjs';
const now=Date.parse('2026-10-31T11:10:00Z');
const sha='a'.repeat(40);
const at='2026-10-31T11:09:00Z';
const future='2026-10-31T11:15:00Z';
const base={now,head:{sha,commit:{committer:{date:at}}},detail:{sha,commit:{message:'fix #18',committer:{date:at}},files:[{filename:'engine/dashboard/index.html',status:'modified',additions:1,deletions:1}]},runs:[{head_sha:sha,status:'completed',conclusion:'success',updated_at:at}],review:{trustedVerifier:true,providerIndependent:true,decision:'approved',commit:sha,at,receiptUrl:'https://example.org/receipt'}};
test('valid exact SHA CI and independent review may establish evidence',()=>{
 const r=evaluateEvidence(base);assert.equal(r.verified,true);assert.equal(r.lastVerifiedCodeAt,new Date(at).toISOString());
});
test('future CI completion cannot reset freshness or be counted as a pass',()=>{
 const r=evaluateEvidence({...base,runs:[{...base.runs[0],updated_at:future}]});
 assert.equal(r.verified,false);assert.equal(r.exactHeadCiAt,null);
});
test('future independent review cannot create verified movement',()=>{
 const r=evaluateEvidence({...base,review:{...base.review,at:future}});
 assert.equal(r.verified,false);assert.equal(r.independentReviewAt,null);
});
test('future deployment and heartbeat receipts cannot establish live evidence',()=>{
 const r=evaluateEvidence({...base,deployment:{httpVerified:true,functionalVerified:true,sha,checkedAt:future},heartbeat:{authenticated:true,at:future}});
 assert.equal(r.lastVerifiedDeploymentAt,null);assert.equal(r.lastAuthenticatedHeartbeatAt,null);
});
