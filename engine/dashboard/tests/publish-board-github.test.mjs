import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQueueSnapshot,publishQueueSnapshot} from '../scripts/publish-board-github.mjs';
const now=Date.parse('2026-11-01T16:20:00Z');
const sample=()=>({schema_version:1,source:'zoo-durable-queue',scope:'Supabase production queue',observed_at:'2026-11-01T16:19:00Z',completed_window_hours:24,
 stats:{total:5,queued:2,running:1,blocked:1,completed_last_24h:1},source_run_id:'queue-publisher:123',source_commit:null,oldest_pending_at:'2026-11-01T15:00:00Z',
 next_tickets:[{id:'ZOO-18',title:'Repair queue worker',issue_url:'https://github.com/london4216-hue/Zoodo/issues/18',asset:'ZOO',agent:'Aider'}],groups:[{asset:'ZOO',priority:'P0',total:5}]});
test('valid snapshot sanitized, no arbitrary secret keys published',()=>{let x=sample();x.secret='NEVER';x.next_tickets[0].token='NEVER';const y=normalizeQueueSnapshot(x,now);assert.equal(y.stats.total,5);assert.ok(!JSON.stringify(y).includes('NEVER'));});
test('reject stale or future snapshots',()=>{let x=sample();x.observed_at='2026-11-01T15:00:00Z';assert.throws(()=>normalizeQueueSnapshot(x,now),/stale/);x.observed_at='2026-11-01T16:30:00Z';assert.throws(()=>normalizeQueueSnapshot(x,now),/future/);});
test('reject invented, inconsistent or unscoped counts',()=>{let x=sample();x.stats.running=3;assert.throws(()=>normalizeQueueSnapshot(x,now),/Inconsistent/);x=sample();delete x.source_run_id;assert.throws(()=>normalizeQueueSnapshot(x,now),/run receipt/);});
test('reject invalid private links and duplicate tickets',()=>{let x=sample();x.next_tickets[0].issue_url='https://example.com/private';assert.throws(()=>normalizeQueueSnapshot(x,now),/Invalid/);x=sample();x.next_tickets.push({...x.next_tickets[0]});assert.throws(()=>normalizeQueueSnapshot(x,now),/duplicate/);});
test('real publication API contract: 404 create, PUT, exact readback',async()=>{let saved=null, calls=[];const fetchImpl=async (url,opts)=>{calls.push(opts.method||'GET');if(opts.method==='PUT'){saved=JSON.parse(opts.body).content;return {ok:true,status:201,json:async()=>({commit:{sha:'abc'}})}}if(!saved)return {ok:false,status:404,json:async()=>({})};return {ok:true,status:200,json:async()=>({sha:'blob',content:saved})}};
 const r=await publishQueueSnapshot(sample(),{token:'TEST',now,fetchImpl});assert.equal(r.source_verified,true);assert.deepEqual(calls,['GET','PUT','GET']);assert.equal(r.production_deployment,'UNKNOWN');});
test('reject replay of same observed_at',async()=>{const content=Buffer.from(JSON.stringify(normalizeQueueSnapshot(sample(),now))).toString('base64');const fetchImpl=async()=>({ok:true,status:200,json:async()=>({sha:'blob',content})});await assert.rejects(publishQueueSnapshot(sample(),{token:'TEST',now,fetchImpl}),/replayed/);});
test('refuse publishing without authorized token',async()=>{await assert.rejects(publishQueueSnapshot(sample(),{now}),/TOKEN/);});
