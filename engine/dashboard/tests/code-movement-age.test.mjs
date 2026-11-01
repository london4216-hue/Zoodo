import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateEvidence} from '../evidence-clock.mjs';

const sha='a'.repeat(40);
const old='2026-10-30T06:00:00Z';
const recent='2026-11-01T08:00:00Z';
const now=Date.parse('2026-11-01T08:01:00Z');
const base={
 now,
 head:{sha,commit:{committer:{date:old}}},
 detail:{sha,commit:{message:'fix #18',committer:{date:old}},
  files:[{filename:'engine/dashboard/example.mjs',status:'modified',additions:1,deletions:1}]},
 runs:[{head_sha:sha,status:'completed',conclusion:'success',updated_at:recent}],
 review:{trustedVerifier:true,providerIndependent:true,decision:'approved',commit:sha,
  at:recent,receiptUrl:'https://example.com/review'}
};
test('late CI and review do not reset the substantive code movement age',()=>{
 const r=evaluateEvidence(base);
 assert.equal(r.verified,true);
 assert.equal(r.lastVerifiedCodeAt,new Date(old).toISOString());
 assert.match(r.state,/ESCALATION DUE/);
 assert.equal(r.exactHeadCiAt,recent);
 assert.equal(r.independentReviewAt,recent);
});
test('future-dated code change cannot become verified from valid review and CI',()=>{
 const r=evaluateEvidence({...base,detail:{...base.detail,
  commit:{...base.detail.commit,committer:{date:'2026-11-02T00:00:00Z'}}}});
 assert.equal(r.verified,false);
 assert.equal(r.lastVerifiedCodeAt,null);
 assert.ok(r.missing.includes('credible code timestamp'));
});
test('missing code timestamp fails closed',()=>{
 const r=evaluateEvidence({...base,detail:{...base.detail,commit:{message:'fix #18'}}});
 assert.equal(r.verified,false);
 assert.equal(r.lastCodeAt,null);
});
test('recent code with contemporaneous review and CI remains verified',()=>{
 const r=evaluateEvidence({...base,
  head:{...base.head,commit:{committer:{date:recent}}},
  detail:{...base.detail,commit:{...base.detail.commit,committer:{date:recent}}}});
 assert.equal(r.verified,true);
 assert.equal(r.lastVerifiedCodeAt,new Date(recent).toISOString());
 assert.equal(r.state,'VERIFIED WITHIN 5 MINUTES');
});
test('unrelated SHA CI remains insufficient',()=>{
 const r=evaluateEvidence({...base,runs:[{...base.runs[0],head_sha:'b'.repeat(40)}]});
 assert.equal(r.verified,false);
 assert.equal(r.exactHeadCiAt,null);
});
