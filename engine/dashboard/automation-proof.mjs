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
 // A public snapshot is not a signature. Reject duplicate role identities or
 // replayed run IDs instead of inflating the count of recorded executions.
 const roles=new Set(),runIds=new Set();
 for(const w of feed.workers){
  if(!w||typeof w.role!=='string'||!w.role.trim()||!RUN.test(w.run_id??''))
   return unknown('Malformed worker identity in published scheduler proof');
  if(roles.has(w.role)||runIds.has(w.run_id))
   return unknown('Duplicate worker role or replayed run ID in scheduler proof');
  roles.add(w.role);runIds.add(w.run_id);
 }
 const valid=feed.workers.filter(w=>w&&typeof w.role==='string'&&RUN.test(w.run_id??'')&&
  w.recorded_status==='completed'&&DATE(w.completed_at)&&DATE(w.scheduled_for)&&
  Date.parse(w.completed_at)>=Date.parse(w.scheduled_for)&&
  Date.parse(w.completed_at)<=observed+60000&&Date.parse(w.completed_at)<=now+60000);
 const last=valid.reduce((a,w)=>!a||Date.parse(w.completed_at)>Date.parse(a.completed_at)?w:a,null);
 if(!last)return unknown('No completed automation execution receipts in published feed');
 // Publisher-side anomalies are separate evidence; never discard them merely
 // because an older completion for that worker remains valid.
 // A malformed anomaly ledger must not disappear and produce a false all-clear.
 if(feed.source_anomalies!==undefined&&!Array.isArray(feed.source_anomalies))
  return unknown('Malformed source anomaly ledger in published feed');
 const anomalies=feed.source_anomalies??[];
 // Keep historical invalid receipts visible for audit, but a later valid
 // completion by the SAME role resolves the active recovery condition.
 // An anomaly without a trustworthy scheduled_for stays unresolved.
 const unresolvedAnomalies=anomalies.filter(a=>!valid.some(w=>
  w.role===a?.role&&DATE(a?.scheduled_for)&&
  Date.parse(w.completed_at)>Date.parse(a.scheduled_for)));
 // The publisher declares the expected worker roster. Missing roles cannot
 // turn a partial scheduler feed into a misleading all-clear.
 const expected=feed.expected_roles===undefined?[]:feed.expected_roles;
 if(!Array.isArray(expected)||expected.some(r=>typeof r!=='string'||!r.trim())||
    new Set(expected).size!==expected.length)return unknown('Invalid expected scheduler roster');
 const overdue=[...new Set([
  ...expected.filter(role=>!valid.some(w=>w.role===role)),
  ...feed.workers.filter(w=>!valid.includes(w)||now-Date.parse(w.completed_at)>dueMs)
   .map(w=>String(w?.role||'Unknown worker')),
  ...unresolvedAnomalies.map(a=>typeof a?.role==='string'&&a.role.trim()?a.role:'Unknown anomaly')
 ])];
 const sourceStale=now-observed>dueMs;
 const status=sourceStale||overdue.length?'RECOVERY REQUIRED':'RECORDED RUNS CURRENT';
 return {state:status,reason:sourceStale?'Published proof source overdue':overdue.length?
  'One or more scheduled workers have overdue or invalid receipts':
  'Automation scheduler execution recorded; active worker heartbeat not verified',
  lastRunAt:last.completed_at,observedAt:feed.observed_at,workerCount:valid.length,overdue,
  activeWorkersVerified:false,sourceStale};
}
