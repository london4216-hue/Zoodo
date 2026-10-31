import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateReviewFeed,createReviewFeedReader,REVIEW_STALE_MS,REVIEW_POLL_MS} from '../review-feed.mjs';
const now=Date.parse('2026-10-31T22:00:00Z');
const row={event_id:'event_1',run_id:'run_schedule_1',review_run_id:'run_review_1',schedule_id:'sched_1',
 scheduled_for:'2026-10-31T21:45:00Z',finished_at:'2026-10-31T21:50:00Z',received_at:'2026-10-31T21:50:01Z',
 task_status:'COMPLETED',review_status:'passed',source_commit:'a'.repeat(40),
 intent_passed:8,intent_failed:0,intent_skipped:0,live_passed:4,live_failed:0,live_skipped:0,
 coverage:'Eight intent suites and BeautyPath public workflows; other assets unverified'};
const feed=(change={})=>({schema_version:1,provider:'trigger.dev',observed_at:'2026-10-31T21:59:00Z',
 latest:{...row,...change},history:[{...row,...change}]});
test('covered test pass is distinct from agent health and legacy scheduler provenance',()=>{
 const value=evaluateReviewFeed(feed(),now);
 assert.equal(value.state,'REVIEW PASSED');assert.equal(value.latest.intent_passed,8);
 assert.match(value.reason,/other assets remain unverified/);
 assert.equal(REVIEW_POLL_MS,30000);assert.equal(REVIEW_STALE_MS,35*60000);
 assert.equal(evaluateReviewFeed({...feed(),provider:'connected_automations_peek'},now).valid,false);
});
test('empty and absent evidence remains unknown',()=>{
 assert.equal(evaluateReviewFeed(null,now).state,'UNKNOWN');
 assert.equal(evaluateReviewFeed({...feed(),latest:null,history:[]},now).state,'UNKNOWN');
 assert.equal(evaluateReviewFeed({...feed(),latest:null},now).valid,false);
});
test('completed but failed tests, failed execution and skipped overlap are distinct',()=>{
 assert.equal(evaluateReviewFeed(feed({review_status:'needs_attention',live_failed:1,live_passed:3}),now).state,'NEEDS ATTENTION');
 assert.equal(evaluateReviewFeed(feed({task_status:'FAILED',review_status:'execution_failed',source_commit:null,
  review_run_id:null,intent_passed:null,live_passed:null}),now).state,'EXECUTION FAILED');
 assert.equal(evaluateReviewFeed(feed({task_status:'SKIPPED',review_status:'skipped_active_review',source_commit:null,
  review_run_id:null}),now).state,'REVIEW SKIPPED');
 for(const change of [{task_status:'COMPLETED',review_status:'execution_failed'},
  {task_status:'FAILED',review_status:'passed'},{task_status:'SKIPPED',review_status:'needs_attention'}])
  assert.equal(evaluateReviewFeed(feed(change),now).valid,false);
});
test('staleness is tied to finished review not frequent GET publication',()=>{
 const old={scheduled_for:'2026-10-31T21:00:00Z',finished_at:'2026-10-31T21:10:00Z',received_at:'2026-10-31T21:10:01Z'};
 assert.equal(evaluateReviewFeed(feed(old),now).state,'STALE');
 assert.equal(evaluateReviewFeed(feed(),Date.parse(row.finished_at)+REVIEW_STALE_MS).state,'REVIEW PASSED');
 assert.equal(evaluateReviewFeed(feed(),Date.parse(row.finished_at)+REVIEW_STALE_MS+1).state,'STALE');
});
test('future, impossible time order, malformed IDs and invalid/contradictory counts fail closed',()=>{
 for(const change of [{scheduled_for:'2026-10-31T21:55:00Z'},
  {finished_at:'2026-10-31T22:01:00Z'},{received_at:'2026-10-31T22:01:00Z'},
  {source_commit:null},{review_run_id:null},{run_id:'<script>'},{task_status:'toString'},{intent_failed:-1},
  {live_failed:0.5},{live_failed:1},{live_skipped:1},{intent_passed:0},{intent_failed:null},
  {live_passed:null},{intent_passed:Number.MAX_SAFE_INTEGER+1}])
  assert.equal(evaluateReviewFeed(feed(change),now).valid,false,JSON.stringify(change));
 assert.equal(evaluateReviewFeed({...feed(),observed_at:'2026-10-31T22:01:01Z'},now).valid,false);
 assert.equal(evaluateReviewFeed({...feed(),observed_at:'2026-10-31T22:00:01Z'},now).valid,true);
 assert.equal(evaluateReviewFeed({...feed(),history:[row,row]},now).valid,false);
});
test('nullable counts remain unknown for nonpassing receipt, never converted to zero',()=>{
 const value=evaluateReviewFeed(feed({review_status:'needs_attention',intent_passed:null,live_passed:null}),now);
 assert.equal(value.state,'NEEDS ATTENTION');assert.equal(value.latest.live_passed,null);
});
test('reader serializes concurrent fetches and uses credential-free bounded noncached GET',async()=>{
 let release,calls=0;
 const pending=new Promise(resolve=>{release=resolve});
 const reader=createReviewFeedReader({now:()=>now,fetcher:async(url,options)=>{
  calls++;assert.match(url,/functions\/v1\/zoo-review-feed\?read=/);
  assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');
  assert.equal(options.credentials,'omit');assert.ok(options.signal);await pending;
  return {ok:true,json:async()=>feed()};
 }});
 const first=reader.refresh(),second=reader.refresh();assert.equal(first,second);release();
 assert.equal((await first).state,'REVIEW PASSED');assert.equal(calls,1);
});
test('reader rejects regressing publications/latest records and retains aging last receipt on error',async()=>{
 let current=feed(),time=now;
 const reader=createReviewFeedReader({now:()=>time,fetcher:async()=>({ok:true,json:async()=>current})});
 await reader.refresh();
 current={...feed(),observed_at:'2026-10-31T21:58:00Z'};
 assert.match((await reader.refresh()).fetchError,/regressed/);
 current=feed({scheduled_for:'2026-10-31T21:30:00Z',finished_at:'2026-10-31T21:40:00Z'});
 assert.match((await reader.refresh()).fetchError,/regressed/);
 current={...feed(),latest:null,history:[]};
 assert.match((await reader.refresh()).fetchError,/regressed/);
 time+=REVIEW_STALE_MS;
 assert.equal(reader.read().state,'STALE');assert.equal(reader.read().latest.run_id,row.run_id);
});
test('reader strips unrecognized raw data and does not render arbitrary backend errors',async()=>{
 const payload=feed();payload.latest.raw_report='PRIVATE';payload.history[0].private_key='SECRET';
 const reader=createReviewFeedReader({now:()=>now,fetcher:async()=>({ok:true,json:async()=>payload})});
 const value=await reader.refresh();
 assert.ok(!JSON.stringify(value).includes('PRIVATE'));assert.ok(!JSON.stringify(value).includes('SECRET'));
 const failing=createReviewFeedReader({now:()=>now,fetcher:async()=>{throw Error('SECRET_TOKEN')}});
 assert.equal((await failing.refresh()).fetchError,'Review feed unavailable or invalid');
});
test('panel remains independent, truthful and mirrored without replacing links or legacy proof',()=>{
 const root=new URL('../',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8');
 const html=read('index.html'),module=read('review-panel.mjs'),mirror=read('scripts/prepare-mirror.mjs');
 assert.match(html,/id="trigger-review"/);assert.match(html,/Completed PRs \/ deployed fixes: UNKNOWN/);
 assert.match(html,/Scheduled cadence: every 15 minutes/);assert.match(html,/Other assets and authenticated workflows remain unverified/);
 assert.match(html,/Base44 public workflows/);assert.match(html,/owner-selected Netlify demo is not covered by these checks/);
 assert.match(html,/id="accountability"/);assert.match(html,/YOUR HOME \/ QUICK LINKS/);
 assert.match(module,/textContent/);assert.doesNotMatch(module,/innerHTML|Authorization|Bearer/);
 assert.match(module,/setInterval\(refresh,REVIEW_POLL_MS\)/);
 for(const asset of ['review-feed.mjs','review-panel.mjs','source-identity.mjs','refresh-policy.mjs','priority-watch.mjs','priority-watch.json','handoff-ledger.json'])
  assert.ok(mirror.includes("'"+asset+"'"),asset);
 assert.match(read('automation-proof.mjs'),/connected_automations_peek/);
});
test('every dashboard entry-point module and its local imports are in mirror allowlist',()=>{
 const root=new URL('../',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8');
 const prep=read('scripts/prepare-mirror.mjs');
 const files=[...prep.matchAll(/^  '([^']+)',/gm)].map(match=>match[1]);
 for(const file of ['index.html',...files.filter(name=>name.endsWith('.mjs'))]){
  for(const match of read(file).matchAll(/(?:from\s+|src=)["']\.\/([^"']+\.mjs)["']/g))
   assert.ok(files.includes(match[1]),file+' imports missing mirror asset '+match[1]);
 }
});
