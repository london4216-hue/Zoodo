#!/usr/bin/env node
// Optional off-GitHub publisher. Requires an operator-provisioned GitHub token
// with contents:write on Zoodo. A GitHub commit is NOT a Netlify deployment.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {normalizeAiderReceipt} from '../worker-feed.mjs';

const REPO='london4216-hue/Zoodo';
const PATH='engine/dashboard/worker-feed.json';
const ENDPOINT='https://api.github.com/repos/'+REPO+'/contents/'+PATH;
const headers=token=>({Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'zoo-receipt-publisher'});
const isDate=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const validId=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9_-]{1,63}$/.test(s);

export function mergeAiderReceipt(remote,record,now=Date.now()) {
  if(remote?.schema_version!==1||remote?.source!=='zoo-worker-receipts'||!Array.isArray(remote.workers))throw Error('Invalid canonical feed');
  if(!isDate(record.observed_at)||Date.parse(record.observed_at)>now+60000)throw Error('Invalid or future Aider timestamp');
  if(remote.observed_at!==null&&(!isDate(remote.observed_at)||Date.parse(remote.observed_at)>now+60000))throw Error('Invalid canonical observation timestamp');
  const seen=new Set();
  for(const w of remote.workers){
    if(!w||!validId(w.worker_id)||seen.has(w.worker_id)||!isDate(w.observed_at)||Date.parse(w.observed_at)>now+60000)throw Error('Invalid existing worker roster');
    seen.add(w.worker_id);
  }
  const old=remote.workers.find(w=>w.worker_id===record.worker_id);
  if(old&&Date.parse(old.observed_at)>=Date.parse(record.observed_at))throw Error('Stale or replayed Aider receipt');
  const observed_at=new Date(Math.max(remote.observed_at===null?0:Date.parse(remote.observed_at),Date.parse(record.observed_at))).toISOString();
  return {schema_version:1,source:'zoo-worker-receipts',observed_at,workers:[...remote.workers.filter(w=>w.worker_id!==record.worker_id),record],publication_scope:'Sanitized receipt claims published to GitHub source; provider invocation and production deployment require independent verification.'};
}

async function api(fetchImpl,url,options){
  const response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>({}));
  return {status:response.status,ok:response.ok,data};
}

export async function publishAiderReceipt(raw,{token,branch='main',fetchImpl=fetch,now=Date.now()}={}){
  if(!token||typeof token!=='string')throw Error('ZOO_GITHUB_TOKEN not configured');
  if(!/^[a-z0-9][a-z0-9._\/-]{0,100}$/i.test(branch)||branch.includes('..'))throw Error('Invalid branch');
  const record=normalizeAiderReceipt(raw);
  const url=ENDPOINT+'?ref='+encodeURIComponent(branch);
  for(let attempt=1;attempt<=2;attempt++){
    const current=await api(fetchImpl,url,{headers:headers(token)});
    if(!current.ok||typeof current.data.sha!=='string'||typeof current.data.content!=='string')throw Error('GitHub canonical feed read failed: HTTP '+current.status);
    const remote=JSON.parse(Buffer.from(current.data.content.replace(/\s/g,''),'base64').toString('utf8'));
    const merged=mergeAiderReceipt(remote,record,now);
    const content=JSON.stringify(merged,null,2)+'\n';
    const put=await api(fetchImpl,ENDPOINT,{method:'PUT',headers:{...headers(token),'Content-Type':'application/json'},body:JSON.stringify({message:'zoo(feed): publish sanitized local worker receipt',content:Buffer.from(content).toString('base64'),sha:current.data.sha,branch})});
    if(put.status===409&&attempt<2)continue;
    if(!put.ok||typeof put.data.commit?.sha!=='string')throw Error('GitHub feed commit failed: HTTP '+put.status);
    const readback=await api(fetchImpl,url,{headers:headers(token)});
    const verified=readback.ok&&typeof readback.data.content==='string'&&Buffer.from(readback.data.content.replace(/\s/g,''),'base64').toString('utf8')===content;
    return {status:verified?'github_source_verified':'github_commit_readback_unverified',commit_sha:put.data.commit.sha,source_verified:verified,attempts:attempt,worker_id:record.worker_id,observed_at:record.observed_at,production_deployment:'UNKNOWN'};
  }
  throw Error('GitHub feed conflict after bounded retry');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--receipt'){
    console.error('Usage: node publish-worker-feed-github.mjs --receipt /trusted/local-receipt.json');process.exitCode=2;
  }else{
    try{
      const receipt=JSON.parse(readFileSync(resolve(args[1]),'utf8'));
      const result=await publishAiderReceipt(receipt,{token:process.env.ZOO_GITHUB_TOKEN});
      console.log(JSON.stringify(result));
    }catch(error){console.error('GitHub feed publication failed: '+error.message);process.exitCode=1;}
  }
}
