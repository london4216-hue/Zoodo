import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchPublishedProof} from '../proof-fetch.mjs';
const older = {observed_at:'2026-10-31T04:00:00Z'};
const fresh = {observed_at:'2026-10-31T05:00:00Z'};
const ok = (feed) => async () => ({ok:true,status:200,json:async()=>feed});
const evaluate = () => ({state:'RECOVERY REQUIRED',reason:'Scheduled worker overdue',activeWorkersVerified:false});
test('returns genuine recovery classification, never fake active-worker success', async()=>{
  const out = await fetchPublishedProof({fetcher:ok(fresh),url:'/automation-proof.json',evaluate,previous:older});
  assert.equal(out.classification.state,'RECOVERY REQUIRED');
  assert.equal(out.classification.activeWorkersVerified,false);
});
test('rejects older snapshots even after a successful HTTP fetch', async()=>{
  await assert.rejects(fetchPublishedProof({fetcher:ok(older),url:'/',evaluate,previous:fresh}),/regressed/);
});
test('rejects invalid feed and HTTP authorization errors', async()=>{
  await assert.rejects(fetchPublishedProof({fetcher:ok(fresh),url:'/',evaluate:()=>({state:'UNKNOWN',reason:'invalid feed'})}),/invalid feed/);
  await assert.rejects(fetchPublishedProof({fetcher:async()=>({ok:false,status:403}),url:'/',evaluate}),/HTTP 403/);
});
test('aborts a hung fetch within the bounded timeout', async()=>{
  const stalled=(_url,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
  });
  const keepAlive=setInterval(()=>{},10);
  try { await assert.rejects(fetchPublishedProof({fetcher:stalled,url:'/',evaluate,timeoutMs:20}),/timeout|aborted/i); }
  finally { clearInterval(keepAlive); }
});
