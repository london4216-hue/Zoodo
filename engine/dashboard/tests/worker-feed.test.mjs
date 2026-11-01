import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateWorkerFeed,normalizeAiderReceipt} from '../worker-feed.mjs';
const NOW=Date.parse('2026-11-01T13:42:00Z');
const at='2026-11-01T13:41:00Z';
const receipt={worker_id:'aider-local',provider:'ollama-local',route:'local-ollama',status:'running',observed_at:at};
const feed=(workers=[receipt],observed_at=at)=>({schema_version:1,source:'zoo-worker-receipts',observed_at,workers});
test('no publisher and future-dated snapshots never establish a worker',()=>{
 assert.equal(evaluateWorkerFeed(null,NOW).state,'UNKNOWN');
 assert.equal(evaluateWorkerFeed(feed([receipt],'2026-11-01T13:50:00Z'),NOW).state,'UNKNOWN');
});
test('local Aider receipt without native ID is UNKNOWN, not RUNNING',()=>{
 const r=evaluateWorkerFeed(feed(),NOW);
 assert.equal(r.workers[0].state,'unknown');assert.equal(r.workers[0].reported_status,'running');
});
test('native receipt claim is shown but explicitly not called independently authenticated',()=>{
 const r=evaluateWorkerFeed(feed([{...receipt,native_run_id:'run_123',receipt_url:'https://example.com/runs/123'}]),NOW);
 assert.equal(r.workers[0].state,'running');assert.equal(r.workers[0].proof,'NATIVE_RECEIPT_REPORTED');
});
test('stale or duplicate worker receipts cannot show live availability',()=>{
 assert.equal(evaluateWorkerFeed(feed([receipt,receipt]),NOW).state,'UNKNOWN');
 const old=feed([{...receipt,observed_at:'2026-11-01T12:00:00Z',native_run_id:'run_1',receipt_url:'https://example.com/run'}],'2026-11-01T12:00:00Z');
 assert.equal(evaluateWorkerFeed(old,NOW).workers[0].state,'unknown');
});
test('quota refill dates require explicit verification and future time',()=>{
 const q={...receipt,status:'quota_exhausted',native_run_id:'r',receipt_url:'https://example.com/r',refill_at:'2026-11-01T15:00:00Z'};
 assert.equal(evaluateWorkerFeed(feed([q]),NOW).workers[0].refill_at,null);
 assert.equal(evaluateWorkerFeed(feed([{...q,refill_verified:true}]),NOW).workers[0].refill_at,q.refill_at);
});
test('Aider adapter strips private paths, secrets and unverified commits',()=>{
 const r=normalizeAiderReceipt({route:'local-ollama',status:'TEST_PASSED',started_at:NOW/1000,model:'qwen2.5-coder',repo:'/private/path',secret:'NEVER',test_exit:0,commit_sha:'fake'});
 assert.equal(r.worker_id,'aider-local');assert.equal(r.status,'unknown');assert.equal(r.last_result,'TEST_PASSED');
 assert.equal(r.commit_sha,null);assert.ok(!JSON.stringify(r).includes('/private/path'));assert.ok(!JSON.stringify(r).includes('NEVER'));
});
