#!/usr/bin/env node
// Publish ONLY a fresh, scoped, sanitized receipt from the existing durable queue.
// This does not query Supabase, invoke a worker, or deploy Netlify.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const REPO='london4216-hue/Zoodo';
const PATH='engine/dashboard/board.json';
const ENDPOINT=`https://api.github.com/repos/${REPO}/contents/${PATH}`;
const REQUIRED=['total','queued','running','blocked','completed_last_24h'];
const whole=x=>Number.isSafeInteger(x)&&x>=0;
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const headers=token=>({Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'zoo-board-receipt-publisher'});
const safeText=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&![...x].some(c=>c.charCodeAt(0)<32);
const issueUrl=x=>typeof x==='string'&&/^https:\/\/github\.com\/london4216-hue\/[A-Za-z0-9_.-]+\/(issues|pull)\/[1-9][0-9]*$/.test(x);

export function normalizeQueueSnapshot(raw,now=Date.now()){
  if(!raw||raw.schema_version!==1||raw.source!=='zoo-durable-queue')throw Error('Expected actual durable queue snapshot schema');
  if(!validTime(raw.observed_at))throw Error('Missing native queue observation timestamp');
  const age=now-Date.parse(raw.observed_at);
  if(age< -60000||age>15*60000)throw Error('Queue observation future or stale');
  if(!safeText(raw.scope,120)||!/^[a-zA-Z0-9 _./-]+$/.test(raw.scope))throw Error('Missing or unsafe queue scope');
  if(raw.completed_window_hours!==24)throw Error('Completion window must be 24h');
  if(!raw.stats||!REQUIRED.every(k=>whole(raw.stats[k])))throw Error('Missing source-backed queue counts');
  const s=Object.fromEntries(REQUIRED.map(k=>[k,raw.stats[k]]));
  if(s.queued+s.running+s.blocked>s.total||s.completed_last_24h>s.total)throw Error('Inconsistent queue totals');
  if(!safeText(raw.source_run_id,120)||!/^[a-zA-Z0-9_.:-]+$/.test(raw.source_run_id))throw Error('Missing queue publisher run receipt ID');
  const next=raw.next_tickets;
  if(!Array.isArray(next)||next.length>5)throw Error('Next tickets must be a scoped array of up to five');
  const ids=new Set();
  const next_tickets=next.map(t=>{
    if(!t||!safeText(t.id,60)||!safeText(t.title,140)||!issueUrl(t.issue_url)||!safeText(t.asset,60)||!safeText(t.agent,80)||ids.has(t.id))throw Error('Invalid or duplicate next ticket');
    ids.add(t.id);
    return {id:t.id,title:t.title,issue_url:t.issue_url,asset:t.asset,agent:t.agent};
  });
  if(!Array.isArray(raw.groups)||raw.groups.length>50)throw Error('Missing or oversized asset/priority groups');
  const groups=raw.groups.map(g=>{
    if(!g||!safeText(g.asset,60)||!safeText(g.priority,30)||!whole(g.total))throw Error('Invalid asset/priority group');
    return {asset:g.asset,priority:g.priority,total:g.total};
  });
  if(raw.oldest_pending_at!==null&&raw.oldest_pending_at!==undefined&&(!validTime(raw.oldest_pending_at)||Date.parse(raw.oldest_pending_at)>now+60000))throw Error('Invalid oldest pending timestamp');
  const source_commit=raw.source_commit===null||raw.source_commit===undefined?null:raw.source_commit;
  if(source_commit!==null&&!/^[0-9a-f]{40}$/.test(source_commit))throw Error('Invalid source SHA');
  // Whitelist prevents arbitrary credentials, customer records and unreviewed raw rows from reaching a public repo.
  return {schema_version:1,source:'zoo-durable-queue',scope:raw.scope,observed_at:raw.observed_at,completed_window_hours:24,stats:s,
    oldest_pending_at:raw.oldest_pending_at??null,next_tickets,groups,source_run_id:raw.source_run_id,source_commit,
    proof_scope:'Source-reported durable queue snapshot. GitHub commit and dashboard readback are not native worker or hosted deployment proof.'};
}
async function api(fetchImpl,url,options){
  const response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(15000)});
  return {ok:response.ok,status:response.status,data:await response.json().catch(()=>({}))};
}
export async function publishQueueSnapshot(raw,{token,branch='main',fetchImpl=fetch,now=Date.now()}={}){
  if(!token||typeof token!=='string')throw Error('ZOO_GITHUB_TOKEN not configured');
  if(!/^[a-z0-9][a-z0-9._/-]{0,100}$/i.test(branch)||branch.includes('..'))throw Error('Invalid branch');
  const record=normalizeQueueSnapshot(raw,now),url=ENDPOINT+'?ref='+encodeURIComponent(branch);
  for(let attempt=1;attempt<=2;attempt++){
    const current=await api(fetchImpl,url,{headers:headers(token)});
    if(!current.ok&&current.status!==404)throw Error('GitHub board read failed: HTTP '+current.status);
    const prior=current.ok?JSON.parse(Buffer.from(current.data.content.replace(/\s/g,''),'base64').toString('utf8')):null;
    if(current.ok&&typeof current.data.sha!=='string')throw Error('Missing canonical board blob SHA');
    if(prior&&(!validTime(prior.observed_at)||Date.parse(prior.observed_at)>=Date.parse(record.observed_at)))throw Error('Queue snapshot stale or replayed');
    const content=JSON.stringify(record,null,2)+'\n';
    const payload={message:'zoo(feed): publish source-scoped durable queue snapshot',content:Buffer.from(content).toString('base64'),branch};
    if(current.ok)payload.sha=current.data.sha;
    const put=await api(fetchImpl,ENDPOINT,{method:'PUT',headers:{...headers(token),'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if((put.status===409||put.status===422)&&attempt<2)continue;
    if(!put.ok||!put.data.commit?.sha)throw Error('GitHub board commit failed: HTTP '+put.status);
    const check=await api(fetchImpl,url,{headers:headers(token)});
    const verified=check.ok&&typeof check.data.content==='string'&&Buffer.from(check.data.content.replace(/\s/g,''),'base64').toString('utf8')===content;
    return {status:verified?'github_source_verified':'github_commit_readback_unverified',commit_sha:put.data.commit.sha,source_verified:verified,observed_at:record.observed_at,source_run_id:record.source_run_id,production_deployment:'UNKNOWN',native_worker_proof:'UNKNOWN'};
  }
  throw Error('GitHub board conflict after bounded retry');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--receipt'){
    console.error('Usage: node publish-board-github.mjs --receipt /trusted/supabase-queue-snapshot.json');process.exitCode=2;
  }else{
    try{console.log(JSON.stringify(await publishQueueSnapshot(JSON.parse(readFileSync(resolve(args[1]),'utf8')),{token:process.env.ZOO_GITHUB_TOKEN})));}
    catch(e){console.error('Queue publication blocked: '+e.message);process.exitCode=1;}
  }
}
