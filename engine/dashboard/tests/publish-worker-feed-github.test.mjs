import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeAiderReceipt,publishAiderReceipt} from '../scripts/publish-worker-feed-github.mjs';
const now=Date.parse('2026-11-01T14:45:00Z');
const record={worker_id:'aider-local',status:'unknown',observed_at:'2026-11-01T14:44:00Z'};
const other={worker_id:'copilot-1',observed_at:'2026-11-01T14:43:00Z',status:'unknown'};
const remote={schema_version:1,source:'zoo-worker-receipts',observed_at:'2026-11-01T14:43:00Z',workers:[other]};
const raw={route:'local-ollama',finished_at:now/1000-60,status:'TEST_PASSED',task_id:'ticket-1'};
test('preserves other workers and updates monotonic clock',()=>{const x=mergeAiderReceipt(remote,record,now);assert.deepEqual(x.workers[0],other);assert.equal(x.workers[1].worker_id,'aider-local');assert.equal(Date.parse(x.observed_at),Date.parse(record.observed_at))});
test('rejects stale replay and malformed existing roster',()=>{assert.throws(()=>mergeAiderReceipt({...remote,workers:[record]},record,now),/Stale/);assert.throws(()=>mergeAiderReceipt({...remote,workers:[other,other]},record,now),/roster/)});
test('rejects future receipt',()=>assert.throws(()=>mergeAiderReceipt(remote,{...record,observed_at:'2026-11-01T14:47:00Z'},now),/future/));
test('requires operator token; no unauthenticated publication',async()=>{await assert.rejects(()=>publishAiderReceipt(raw,{now}),/TOKEN/)});
test('commits with compare-and-swap and verifies source readback',async()=>{
 let calls=[];let committed=null;
 const fake=async(url,opt)=>{calls.push({url,method:opt.method||'GET'});if(opt.method==='PUT'){const body=JSON.parse(opt.body);assert.equal(body.sha,'old-blob');committed=Buffer.from(body.content,'base64').toString('utf8');return {ok:true,status:200,json:async()=>({commit:{sha:'a'.repeat(40)}})}}const content=committed??JSON.stringify(remote);return {ok:true,status:200,json:async()=>({sha:'old-blob',content:Buffer.from(content).toString('base64')})}};
 const x=await publishAiderReceipt(raw,{token:'test-token',fetchImpl:fake,now});assert.equal(x.source_verified,true);assert.equal(x.commit_sha,'a'.repeat(40));assert.equal(calls.length,3);assert.equal(x.production_deployment,'UNKNOWN');
});
test('bounded 409 conflict retries once and re-reads canonical',async()=>{
 let puts=0;let gets=0;let latest=null;
 const fake=async(url,opt)=>{if(opt.method==='PUT'){puts++;if(puts===1)return{ok:false,status:409,json:async()=>({})};latest=Buffer.from(JSON.parse(opt.body).content,'base64').toString('utf8');return{ok:true,status:200,json:async()=>({commit:{sha:'b'.repeat(40)}})}}gets++;return{ok:true,status:200,json:async()=>({sha:'old-blob',content:Buffer.from(latest??JSON.stringify(remote)).toString('base64')})}};
 const x=await publishAiderReceipt(raw,{token:'test-token',fetchImpl:fake,now});assert.equal(x.attempts,2);assert.equal(puts,2);assert.equal(gets,3);
});
test('never claims readback success when GitHub returns older source',async()=>{
 const fake=async(url,opt)=>opt.method==='PUT'?{ok:true,status:200,json:async()=>({commit:{sha:'c'.repeat(40)}})}:{ok:true,status:200,json:async()=>({sha:'old-blob',content:Buffer.from(JSON.stringify(remote)).toString('base64')})};
 const x=await publishAiderReceipt(raw,{token:'test-token',fetchImpl:fake,now});assert.equal(x.source_verified,false);assert.equal(x.status,'github_commit_readback_unverified');
});
