import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateEvidence} from '../evidence-clock.mjs';

const now=Date.parse('2026-10-31T22:50:00Z');
const at=offset=>new Date(now+offset).toISOString();
const sha='a'.repeat(40);
function fixture(){
 return {
  now,
  head:{sha,commit:{committer:{date:at(-120000)}}},
  detail:{sha,files:[{filename:'engine/dashboard/evidence-clock.mjs',status:'modified',additions:1,deletions:0}],
   commit:{message:'fix #18 evidence integrity',committer:{date:at(-120000)}}},
  runs:[{head_sha:sha,status:'completed',conclusion:'success',updated_at:at(-120000)}],
  review:{trustedVerifier:true,providerIndependent:true,decision:'approved',commit:sha,at:at(-60000),receiptUrl:'https://example.com/receipt'},
  deployment:{httpVerified:true,functionalVerified:true,sha,checkedAt:at(-60000)},
  heartbeat:{authenticated:true,at:at(-60000)}
 };
}
test('valid historical receipts remain verified without becoming deployment or worker claims',()=>{
 const v=evaluateEvidence(fixture());
 assert.equal(v.verified,true);
 assert.equal(v.lastVerifiedDeploymentAt,at(-60000));
 assert.equal(v.lastAuthenticatedHeartbeatAt,at(-60000));
});
test('future-dated successful CI cannot produce verified green movement',()=>{
 const f=fixture();f.runs[0].updated_at=at(3600000);
 const v=evaluateEvidence(f);
 assert.equal(v.verified,false);assert.equal(v.exactHeadCiAt,null);
 assert.match(v.state,/UNKNOWN/);
});
test('future-dated independent review cannot produce verified green movement',()=>{
 const f=fixture();f.review.at=at(3600000);
 const v=evaluateEvidence(f);
 assert.equal(v.verified,false);assert.equal(v.independentReviewAt,null);
});
test('future-dated host probe is not verified deployment',()=>{
 const f=fixture();f.deployment.checkedAt=at(3600000);
 const v=evaluateEvidence(f);
 assert.equal(v.lastVerifiedDeploymentAt,null);
});
test('future-dated authenticated heartbeat is not a live worker receipt',()=>{
 const f=fixture();f.heartbeat.at=at(3600000);
 const v=evaluateEvidence(f);
 assert.equal(v.lastAuthenticatedHeartbeatAt,null);
});
test('future-dated commit metadata is not displayed as recent activity',()=>{
 const f=fixture();f.head.commit.committer.date=at(3600000);
 f.detail.commit.committer.date=at(3600000);
 const v=evaluateEvidence(f);
 assert.equal(v.lastCommitAt,null);assert.equal(v.lastCodeAt,null);
});
test('small 30-second clock skew is tolerated for CI, review, host and heartbeat',()=>{
 const f=fixture();f.runs[0].updated_at=at(30000);
 f.review.at=at(30000);f.deployment.checkedAt=at(30000);f.heartbeat.at=at(30000);
 const v=evaluateEvidence(f);
 assert.equal(v.verified,true);
 assert.equal(v.lastVerifiedDeploymentAt,at(30000));
 assert.equal(v.lastAuthenticatedHeartbeatAt,at(30000));
});
test('timestamp 61 seconds ahead is quarantined',()=>{
 const f=fixture();f.runs[0].updated_at=at(61000);
 assert.equal(evaluateEvidence(f).verified,false);
});
