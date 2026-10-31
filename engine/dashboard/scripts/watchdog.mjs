#!/usr/bin/env node
// Out-of-browser watchdog for a published, authenticated scheduler snapshot.
// Does not invoke ChatGPT, prove active agents, or authorize production deploys.
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const ROLES=['ZOO Keeper','ZOO Agent Hunter','ZOO Dashboard Worker','ZOO Asset Restoration'];
const GRACE=75*60*1000;
const validDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const validId=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(s);
export function evaluateSnapshot(feed,now=Date.now(),grace=GRACE){
 const problems=[],runIds={},lastCompletions={};
 if(!feed||feed.schema_version!==1||feed.source!=='connected_automations_peek'||!validDate(feed.observed_at)||!Array.isArray(feed.workers)){
  return {state:'RECOVERING',problems:['INVALID_OR_MISSING_FEED'],runIds,lastCompletions,observedAt:null};
 }
 const observed=Date.parse(feed.observed_at);
 if(observed>now+60000)problems.push('FUTURE_FEED_TIMESTAMP');
 if(now-observed>grace)problems.push('PUBLISHED_FEED_OVERDUE');
 const seen=new Set();
 for(const role of ROLES){
  const entries=feed.workers.filter(w=>w?.role===role);
  if(entries.length!==1){problems.push(`${role}:MISSING_OR_DUPLICATE_WORKER`);continue;}
  const w=entries[0];runIds[role]=w.run_id??null;
  if(w.recorded_status!=='completed'||!validId(w.run_id)||!validDate(w.scheduled_for)||!validDate(w.completed_at)){
   problems.push(`${role}:INVALID_COMPLETION`);continue;
  }
  if(seen.has(w.run_id)){problems.push(`${role}:REPLAYED_RUN_ID`);continue;}
  seen.add(w.run_id);
  const done=Date.parse(w.completed_at),scheduled=Date.parse(w.scheduled_for);
  if(done<scheduled||done>observed+60000||done>now+60000){problems.push(`${role}:IMPOSSIBLE_RUN_TIME`);continue;}
  lastCompletions[role]=w.completed_at;
  if(now-done>grace)problems.push(`${role}:OVERDUE_COMPLETION`);
 }
 return {state:problems.length?'RECOVERING':'SCHEDULER_RECEIPTS_CURRENT',problems,runIds,lastCompletions,observedAt:feed.observed_at};
}
export function fingerprint(result){
 return createHash('sha256').update(JSON.stringify({state:result.state,problems:[...result.problems].sort(),runIds:result.runIds})).digest('hex').slice(0,20);
}
export function parseLastWatchdogComment(comments){
 for(const c of [...comments].reverse()){
  const m=String(c?.body||'').match(/<!-- zoo-watchdog:v1 state=(RECOVERING|SCHEDULER_RECEIPTS_CURRENT) key=([a-f0-9]{20}) -->/);
  if(m)return {state:m[1],key:m[2]};
 }
 return null;
}
export async function checkOnce({loadProof,readComments,postComment,now=Date.now(),sha='unknown'}){
 let result;
 try{result=evaluateSnapshot(await loadProof(),now);}catch(e){
  result={state:'RECOVERING',problems:['PROOF_FETCH_ERROR_'+String(e?.status||'UNKNOWN')],runIds:{},lastCompletions:{},observedAt:null};
 }
 const key=fingerprint(result),last=parseLastWatchdogComment(await readComments());
 if(result.state==='SCHEDULER_RECEIPTS_CURRENT'&&last?.state!=='RECOVERING')return {...result,key,action:'NO_RECOVERY_OPEN'};
 if(last?.state===result.state&&last?.key===key)return {...result,key,action:'DEDUPED'};
 const marker=`<!-- zoo-watchdog:v1 state=${result.state} key=${key} -->`;
 const recovery=result.state==='RECOVERING';
 const body=`${marker}\n**ZOO scheduler-proof watchdog: ${recovery?'RECOVERING':'scheduler receipts current (not production verified)'}.**\n\n`+
  `Observed UTC: ${new Date(now).toISOString()} · watchdog source SHA: \`${sha}\` · published feed: ${result.observedAt||'UNKNOWN'}.\n`+
  `Recorded worker runs: \`${JSON.stringify(result.runIds)}\`.\n`+
  `Evidence defects: ${recovery?result.problems.map(x=>'\`'+x+'\`').join(', '):'none in scheduler snapshot; live agent activity and production deployment remain unverified'}.\n`+
  `Accountable: ZOO Dashboard Worker. Independent backup: ZOO Agent Hunter. Integration: Sole ZOO Keeper.\n`+
  `Next executable action: ${recovery?'read connected Automations run_details, repair/publish single-writer proof, check worker schedule and issue #1023; do not fake completion':'continue external checks of Netlify source/deploy, real links, authenticated live refresh and independent browser QA'}.\n`+
  `This GitHub check cannot wake ChatGPT workers or independently authenticate their executions.`;
 await postComment(body);
 return {...result,key,action:recovery?'RECOVERY_CHECKPOINT_POSTED':'RECOVERY_OBSERVED_POSTED'};
}
async function githubApi(path,token,method='GET',body){
 const res=await fetch('https://api.github.com/repos/london4216-hue/Zoodo'+path,{
  method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'zoo-proof-watchdog'},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok){const err=new Error(`GitHub HTTP ${res.status}`);err.status=res.status;throw err;}
 return {data:await res.json(),link:res.headers.get('link')||''};
}
export async function main(env=process.env){
 if(env.GITHUB_REPOSITORY!=='london4216-hue/Zoodo'||!env.GITHUB_TOKEN)throw Error('Required authorized repository/token missing');
 const ref=env.PROOF_REF||env.GITHUB_REF_NAME;
 if(!ref)throw Error('Explicit proof source ref missing');
 const token=env.GITHUB_TOKEN;
 const loadProof=async()=>{
  const r=await githubApi(`/contents/engine/dashboard/automation-proof.json?ref=${encodeURIComponent(ref)}`,token);
  if(r.data.encoding!=='base64'||!r.data.content)throw Error('Unsupported proof content encoding');
  return JSON.parse(Buffer.from(r.data.content.replace(/\s/g,''),'base64').toString('utf8'));
 };
 const readComments=async()=>{
  const first=await githubApi('/issues/17/comments?per_page=100&page=1',token);
  const match=first.link.match(/<[^>]*[?&]page=(\d+)[^>]*>; rel="last"/);
  const last=match&&Number(match[1])>1?await githubApi(`/issues/17/comments?per_page=100&page=${Number(match[1])}`,token):first;
  return last.data;
 };
 const postComment=async body=>githubApi('/issues/17/comments',token,'POST',{body});
 const r=await checkOnce({loadProof,readComments,postComment,sha:env.GITHUB_SHA||'unknown'});
 console.log(JSON.stringify({state:r.state,problems:r.problems,action:r.action,observedAt:r.observedAt,sourceSha:env.GITHUB_SHA||'unknown'}));
 if(r.state==='RECOVERING')process.exitCode=2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{console.error('ZOO watchdog blocked:',String(e.message||e));process.exitCode=1;});
}
