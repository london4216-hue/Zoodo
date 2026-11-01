// ZOO P0 priority feed. This public view consumes sanitized authenticated snapshots,
// never private GitHub API tokens or page-load timestamps as worker evidence.
const $=id=>document.getElementById(id);
let lastGood=null;
function age(iso){const t=Date.parse(iso||'');if(!Number.isFinite(t))return 'UNKNOWN';const diff=Date.now()-t;if(diff<0)return 'INVALID FUTURE TIMESTAMP';return Math.floor(diff/3600000)+'h '+Math.floor((diff%3600000)/60000)+'m';}
async function refreshPriority(){
 try{
  const response=await fetch('./priority-watch.json?read='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const d=await response.json();
  if(d.schema_version!==1||d.source!=='authenticated_github_connector_read'||!d.priority||!d.sara)throw Error('invalid source schema');
  if(!Number.isFinite(Date.parse(d.observed_at))||Date.parse(d.observed_at)>Date.now()+60000)throw Error('invalid source timestamp');
  lastGood=d;
  const p=d.priority,s=d.sara;
  $('zoo787stage').textContent=p.stage||'UNKNOWN';
  $('zoo787detail').textContent='Head '+(p.source_head_sha||'UNKNOWN')+' · responsible worker '+(p.responsible_worker||'UNKNOWN')+' · independent tests '+(p.last_test?.state||'UNKNOWN')+' · next: '+(p.next_action||'UNKNOWN');
  $('zoo787drift').textContent='Last VERIFIED meaningful task movement: UNKNOWN (no independent receipt). PR metadata last changed '+age(p.last_meaningful_update_at)+' ago; NOT a worker heartbeat.';
  $('zooSaraState').textContent=s.state||'UNKNOWN';
  $('zooSaraDetail').textContent=s.url&&s.last_verified_at?'Verified URL: '+s.url:'URL UNKNOWN · '+(s.next_action||'verification pending');
  $('zooPriorityReceipt').textContent='Authenticated source observed '+d.observed_at+' · source age '+age(d.observed_at)+' · production proof '+(d.dashboard?.production_verified?'VERIFIED':'UNKNOWN')+' · last FETCH '+new Date().toISOString()+' (not execution evidence).';
 }catch(e){
  $('zoo787stage').textContent='RECOVERING';
  $('zoo787detail').textContent='PR source/head/test UNKNOWN · latest feed check failed; last snapshot is historical only.';
  $('zoo787drift').textContent='Verified meaningful task movement UNKNOWN · no current source evidence; not a worker heartbeat.';
  $('zooSaraState').textContent='UNKNOWN';
  $('zooSaraDetail').textContent='URL NOT CURRENTLY VERIFIED · source feed unavailable.';
  $('zooPriorityReceipt').textContent='PRIORITY FEED UNAVAILABLE: '+String(e.message||e)+' · last valid snapshot '+(lastGood?.observed_at||'UNKNOWN')+' · next: repair same-origin feed and verify Netlify deploy.';
 }
}
$('refresh')?.addEventListener('click',refreshPriority);
refreshPriority();
setInterval(refreshPriority,60000);
