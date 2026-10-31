// Trigger.dev evidence is separate from agent heartbeat, merged PRs and fixes.
export const REVIEW_POLL_MS=30000;
export const REVIEW_STALE_MS=35*60000;
// Account for small device/server clock differences, never future scheduled work.
export const REVIEW_CLOCK_SKEW_MS=60000;
export const REVIEW_FEED_URL='https://srqlfqnykkzxewwxsxvy.supabase.co/functions/v1/zoo-review-feed';
const TIME=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const ID=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,160}$/.test(x);
const COUNTS=['intent_passed','intent_failed','intent_skipped','live_passed','live_failed','live_skipped'];
const PAIRS={COMPLETED:['passed','needs_attention'],FAILED:['execution_failed'],SKIPPED:['skipped_active_review']};
function record(row,observed,now){
 if(!row||!['event_id','run_id','schedule_id'].every(key=>ID(row[key]))||
    !(row.review_run_id===null||ID(row.review_run_id))||
    !Object.hasOwn(PAIRS,row.task_status)||!PAIRS[row.task_status].includes(row.review_status)||
    !['scheduled_for','finished_at','received_at'].every(key=>TIME(row[key]))||
    !COUNTS.every(key=>row[key]===null||Number.isSafeInteger(row[key])&&row[key]>=0)||
    !(row.source_commit===null||/^[a-f0-9]{40}$/.test(row.source_commit))||
    typeof row.coverage!=='string'||row.coverage.length>800)return null;
 const scheduled=Date.parse(row.scheduled_for),finished=Date.parse(row.finished_at),received=Date.parse(row.received_at);
 if(scheduled>finished||finished>received||received>observed||observed>now+REVIEW_CLOCK_SKEW_MS)return null;
 if(row.task_status==='COMPLETED'&&(!row.source_commit||!row.review_run_id))return null;
 if(row.review_status==='passed'&&!(row.intent_passed>0&&row.live_passed>0&&
   ['intent_failed','intent_skipped','live_failed','live_skipped'].every(key=>row[key]===0)))return null;
 const keys=['event_id','run_id','review_run_id','schedule_id','scheduled_for','finished_at',
  'task_status','review_status','source_commit',...COUNTS,'coverage','received_at'];
 return Object.fromEntries(keys.map(key=>[key,row[key]]));
}
export function evaluateReviewFeed(feed,now=Date.now()){
 const unknown=reason=>({valid:false,state:'UNKNOWN',reason,latest:null,history:[],observedAt:null});
 if(feed===null||feed===undefined)return unknown('No connected review receipt is available');
 if(feed?.schema_version!==1||feed.provider!=='trigger.dev'||!TIME(feed.observed_at)||
    Date.parse(feed.observed_at)>now+REVIEW_CLOCK_SKEW_MS||!Array.isArray(feed.history)||feed.history.length>20)
  return unknown('Review evidence schema or publication time is invalid');
 const observed=Date.parse(feed.observed_at),history=feed.history.map(row=>record(row,observed,now));
 if(history.some(row=>!row)||new Set(history.map(row=>row.event_id)).size!==history.length)
  return unknown('Review history contains invalid or duplicate receipts');
 if(feed.latest===null){
  if(history.length)return unknown('Latest receipt is missing from nonempty review history');
  return {valid:true,state:'UNKNOWN',reason:'No review receipt has been published',latest:null,history:[],observedAt:feed.observed_at};
 }
 const latest=record(feed.latest,observed,now);
 if(!latest)return unknown('Latest review receipt has invalid fields, counts, or timestamp order');
 if(history.some(row=>Date.parse(row.scheduled_for)>Date.parse(latest.scheduled_for)))
  return unknown('Latest review receipt is older than published history');
 const stale=now-Date.parse(latest.finished_at)>REVIEW_STALE_MS||now-observed>REVIEW_STALE_MS;
 const state=stale?'STALE':latest.task_status==='FAILED'?'EXECUTION FAILED':
  latest.task_status==='SKIPPED'?'REVIEW SKIPPED':latest.review_status==='passed'?'REVIEW PASSED':'NEEDS ATTENTION';
 return {valid:true,state,reason:stale?'Last review receipt is more than 35 minutes old':
  state==='REVIEW PASSED'?'Covered checks passed; other assets remain unverified':
  state==='NEEDS ATTENTION'?'Scheduler completed, but the covered review did not pass':
  state==='REVIEW SKIPPED'?'Overlapping active review prevented a new review; not a passing result':
  'Scheduled task failed to execute the review',latest,history,observedAt:feed.observed_at};
}
export function createReviewFeedReader({fetcher=fetch,now=Date.now}={}){
 let snapshot=null,inFlight=null,lastError=null;
 const read=()=>({...evaluateReviewFeed(snapshot,now()),fetchError:lastError});
 function refresh(){
  if(inFlight)return inFlight;
  inFlight=(async()=>{
   try{
    const response=await fetcher(REVIEW_FEED_URL+'?read='+now(),{
     method:'GET',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
     signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Review feed HTTP '+response.status);
    const candidate=await response.json(),next=evaluateReviewFeed(candidate,now());
    if(!next.valid)throw Error(next.reason);
    if(snapshot&&(Date.parse(next.observedAt)<Date.parse(snapshot.observed_at)||
      snapshot.latest&&(!next.latest||
        Date.parse(next.latest.scheduled_for)<Date.parse(snapshot.latest.scheduled_for)||
        Date.parse(next.latest.finished_at)<Date.parse(snapshot.latest.finished_at))))
     throw Error('Review feed snapshot regressed');
    snapshot={schema_version:1,provider:'trigger.dev',observed_at:next.observedAt,latest:next.latest,history:next.history};
    lastError=null;
   }catch(error){
    lastError=error?.message?.startsWith('Review feed HTTP ')?error.message:
     error?.message==='Review feed snapshot regressed'?error.message:'Review feed unavailable or invalid';
   }finally{inFlight=null;}
   return read();
  })();
  return inFlight;
 }
 return {refresh,read};
}
