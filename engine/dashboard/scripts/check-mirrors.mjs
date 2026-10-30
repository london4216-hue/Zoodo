#!/usr/bin/env node
/**
 * Standalone, credential-free deployment health gate for primary and independent mirrors.
 * Run on ANY provider or scheduled environment. Different providers must report the same
 * exact source SHA, and actual HTML / lab JS must be served. A green deploy status alone
 * is NEVER evidence of working end-to-end UX or active agents.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const SHA=/^[a-f0-9]{40}$/;
const MAX_MS=9000;
const safeHttps = value => {
  try {
    const u=new URL(value);
    if(u.protocol !== 'https:' || u.username || u.password || u.port || !u.hostname.includes('.')) return null;
    if(/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(u.hostname)) return null;
    u.pathname='/';u.search='';u.hash='';
    return u.toString();
  }catch{return null;}
};
export async function inspectMirror(url, {fetcher=fetch,expectedSha=null, requireManifest=true, now=()=>new Date().toISOString()}={}) {
  const base=safeHttps(url);
  if(!base)return {url:null,state:'NOT_CONFIGURED',reason:'missing_or_unsafe_https_url',checked_at:now()};
  const report={url:base,state:'RECOVERING',checked_at:now(),checks:{}};
  try{
    const get=async(path,{json=false}={})=>{
      const response=await fetcher(new URL(path,base),{redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(MAX_MS)});
      if(!response.ok)throw Error(path+'_http_'+response.status);
      const final=new URL(response.url||new URL(path,base).toString());
      if(final.origin!==new URL(base).origin) throw Error(path+'_unexpected_redirect_origin');
      return json?response.json():response.text();
    };
    const proof=await get('build-proof.json',{json:true});
    const manifest=requireManifest?await get('mirror-manifest.json',{json:true}):null;
    if(proof.build_tests!=='PASSED'||(requireManifest&&manifest?.schema_version!==1))throw Error('invalid_build_receipts');
    const sha=proof.source_commit;
    if(!SHA.test(sha||'')||(requireManifest&&manifest.source_commit!==sha))throw Error('missing_or_mismatched_sha');
    report.checks.build_proof={sha,verified_at:proof.verified_at};
    if(expectedSha && sha!==expectedSha)throw Error('source_sha_mismatch');
    const html=await get('index.html');
    if(!html.includes('id="accountability"')||html.includes('EVIDENCE UNKNOWN · ESCALATION REQUIRED'))throw Error('wrong_dashboard_build');
    for(const [file,needle] of [
      ['evidence-clock.mjs','export function evaluateEvidence'],
      ['automation-proof.mjs','export function evaluateAutomationProof'],
      ['automation-proof.json','"source": "connected_automations_peek"'],
      ['labs/myblock/index.html','My Block · Creator-first lab'],
      ['labs/myblock/logic.mjs','export function publishPost'],
      ['labs/yearbook3/index.html','Yearbook 3 · Student Lab'],
      ['labs/yearbook3/logic.mjs','export function submitEntry']])
      if(!(await get(file)).includes(needle))throw Error('missing_or_stale_asset:'+file);
    report.checks.static_assets='PASSED';
    report.state='STATIC_SOURCE_VERIFIED';
    report.note='Host served matching static HTML and lab assets. Not proof of authenticated agent activity or full browser functionality.';
  }catch(error){
    report.reason=String(error.message||'check_failed').slice(0,180);
  }
  return report;
}

export async function verifyFleet({config,fetcher=fetch, expectedSha=null}={}){
 if(!config||!Array.isArray(config.mirrors))throw Error('invalid_host_config');
 const targets=[config.primary,...config.mirrors];
 const results=await Promise.all(targets.map((host,i)=>
   host?.url?inspectMirror(host.url,{fetcher,expectedSha,requireManifest:i!==0}):
   Promise.resolve({provider:host?.provider||'unknown',state:'NOT_CONFIGURED'})));
 // A passing URL is not independent redundancy: require identical exact SHA,
 // distinct configured provider identities and distinct origins. If the primary
 // is down, matching healthy mirrors can still be evaluated against one another.
 const firstGood=results.find(x=>x.state==='STATIC_SOURCE_VERIFIED');
 const sourceSha=expectedSha||firstGood?.checks?.build_proof?.sha||null;
 const providers=new Set(),origins=new Set();
 let healthy=0;
 const hosts=results.map((result,i)=>{
   const host={provider:targets[i]?.provider||'unknown',...result};
   if(host.state!=='STATIC_SOURCE_VERIFIED')return host;
   const sha=host.checks?.build_proof?.sha;
   if(!sourceSha||sha!==sourceSha){
     return {...host,state:'SOURCE_MISMATCH',reason:'different_exact_source_sha'};
   }
   const provider=String(host.provider).trim().toLowerCase();
   const origin=host.url?new URL(host.url).origin:null;
   if(!provider||provider==='unknown'||!origin||providers.has(provider)||origins.has(origin)){
     return {...host,state:'DUPLICATE_OR_UNVERIFIED_HOST',reason:'duplicate_provider_or_origin'};
   }
   providers.add(provider);origins.add(origin);healthy++;
   return host;
 });
 return {checked_at:new Date().toISOString(),hosts,healthy,
   common_source_sha:sourceSha,
   source_matched_distinct_configured_providers:healthy,
   independently_authenticated_provider_identities_verified:false,
   fully_automated_failover_verified:false,
   note:'Same-SHA static endpoints on distinct configured providers are NOT authenticated provider ownership, DNS routing, full browser functionality or active agent execution.'};
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href) {
 const p=resolve(dirname(fileURLToPath(import.meta.url)),'../hosting-mirrors.json');
 let cfg;
 try{cfg=JSON.parse(readFileSync(p,'utf8'))}catch(e){console.error('invalid_host_registry:',e.message);process.exit(2)}
 const required=process.env.ZOO_EXPECT_SHA||null;
 verifyFleet({config:cfg,expectedSha:required}).then(fleet=>{
   console.log(JSON.stringify(fleet,null,2));
   // unconfigured mirrors are transparently counted as missing redundancy; do not mark green.
   const total=fleet.hosts.filter(x=>x.state==='STATIC_SOURCE_VERIFIED').length;
   process.exit(total>=2?0:2);
 }).catch(e=>{console.error(e.message);process.exit(2)});
}
