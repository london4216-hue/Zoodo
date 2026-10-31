import {createReviewFeedReader,REVIEW_POLL_MS} from './review-feed.mjs';
const reader=createReviewFeedReader(),$=id=>document.getElementById(id);
const stamp=value=>value?new Date(value).toLocaleString():'UNKNOWN';
const count=value=>Number.isSafeInteger(value)?String(value):'UNKNOWN';
function render(){
 const view=reader.read(),latest=view.latest;
 const label=view.fetchError?(latest?'CONNECTION WARNING':'UNKNOWN'):view.state;
 $('reviewStatus').textContent=label;
 $('reviewStatus').className='receipt '+(!view.fetchError&&view.state==='REVIEW PASSED'?'good':'warn');
 $('reviewReason').textContent=(view.fetchError?view.fetchError+'; retained receipt is '+view.state+'. ':'')+view.reason;
 $('reviewTimes').textContent=latest?'Scheduled: '+stamp(latest.scheduled_for)+' · finished: '+stamp(latest.finished_at)+
  ' · feed observed: '+stamp(view.observedAt):'Last completed review: UNKNOWN · waiting for a valid connected receipt.';
 $('reviewExecution').textContent=latest?'Task execution: '+latest.task_status+' · review outcome: '+latest.review_status:
  'Task execution: UNKNOWN · review outcome: UNKNOWN';
 for(const [id,prefix] of [['reviewIntent','intent'],['reviewLive','live']])
  $(id).textContent=latest?count(latest[prefix+'_passed'])+' passed / '+count(latest[prefix+'_failed'])+
   ' failed / '+count(latest[prefix+'_skipped'])+' skipped':'Not measured';
 $('reviewIdentity').textContent=latest?'Run: '+latest.run_id+
  (latest.review_run_id?' · child review: '+latest.review_run_id:'')+
  ' · source commit: '+(latest.source_commit||'UNKNOWN'):'Run and tested source commit: UNKNOWN';
 $('reviewCoverage').textContent=latest?'Recorded coverage: '+latest.coverage:
  'Expected coverage: eight intent suites and BeautyPath public desktop/mobile workflows.';
 const rows=$('reviewHistory');rows.replaceChildren();
 for(const receipt of view.history.slice(0,5)){
  const row=document.createElement('div');row.className='row';
  row.textContent=stamp(receipt.scheduled_for)+' · '+receipt.task_status+' / '+receipt.review_status+
   ' · finished '+stamp(receipt.finished_at)+' · '+receipt.run_id;
  rows.append(row);
 }
 if(!view.history.length)rows.textContent='No historical review receipts available.';
}
async function refresh(){
 $('reviewFetch').textContent='Review feed fetch attempted: '+new Date().toISOString();
 await reader.refresh();render();
}
$('refresh')?.addEventListener('click',refresh);
refresh();setInterval(refresh,REVIEW_POLL_MS);
// Repainting cannot renew evidence. Retained receipts age even while offline.
setInterval(render,1000);
