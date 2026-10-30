// Public view of authenticated automation-run snapshots. The record is a
// provenance claim from the ZOO publisher, NOT a signature or live worker ping.
const DATE = s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const RUN=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
export function evaluateAutomationProof(feed, now=Date.now(), dueMs=75*60000){
 const unknown=(reason)=>({state:'UNKNOWN',reason,lastRunAt:null,observedAt:null,workerCount:0,overdue:[],activeWorkersVerified:false});
 if(feed?.schema_version!==1||feed?.source!=='connected_automations_peek'||!DATE(feed.observed_at)||
    !Array.isArray(feed.workers)||!feed.workers.length)return unknown('No valid published automation-run proof');
 const observed=Date.parse(feed.observed_at);
 if(observed>now+60000)return unknown('Evidence publication timestamp is in the future');
 const valid=feed.workers.filter(w=>w&&typeof w.role==='string'&&RUN.test(w.run_id??'')&&
  w.recorded_status==='completed'&&DATE(w.completed_at)&&DATE(w.scheduled_for)&&
  Date.parse(w.completed_at)<=observed+60000&&Date.parse(w.completed_at)<=now+60000);
 const last=valid.reduce((a,w)=>!a||Date.parse(w.completed_at)>Date.parse(a.completed_at)?w:a,null);
 if(!last)return unknown('No completed automation execution receipts in published feed');
 const overdue=feed.workers.filter(w=>!valid.includes(w)||now-Date.parse(w.completed_at)>dueMs)
  .map(w=>String(w?.role||'Unknown worker'));
 const sourceStale=now-observed>dueMs;
 const status=sourceStale||overdue.length?'RECOVERY REQUIRED':'RECORDED RUNS CURRENT';
 return {state:status,reason:sourceStale?'Published proof source overdue':overdue.length?
  'One or more scheduled workers have overdue or invalid receipts':
  'Automation scheduler execution recorded; active worker heartbeat not verified',
  lastRunAt:last.completed_at,observedAt:feed.observed_at,workerCount:valid.length,overdue,
  activeWorkersVerified:false,sourceStale};
}
