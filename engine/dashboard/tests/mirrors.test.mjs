import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectMirror,verifyFleet} from '../scripts/check-mirrors.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const registry=JSON.parse(readFileSync(resolve(root,'hosting-mirrors.json'),'utf8'));
const sha='a'.repeat(40);
const base='https://second-host.example/';
function mockSuccess(url) {
 const name=new URL(url).pathname;
 const json=name==='/build-proof.json'?{schema_version:1,build_tests:'PASSED',source_commit:sha,verified_at:'2026-10-30T16:00:00Z'}:
 name==='/mirror-manifest.json'?{schema_version:1,source_commit:sha}:null;
 const bodies={
  '/index.html':'<section id="accountability">LIVE SOURCE</section>',
  '/evidence-clock.mjs':'export function evaluateEvidence(input) {}',
  '/automation-proof.mjs':'export function evaluateAutomationProof(feed) {}',
  '/automation-proof.json':'{\n  "source": "connected_automations_peek"\n}',
  '/labs/myblock/index.html':'My Block · Creator-first lab',
  '/labs/myblock/logic.mjs':'export function publishPost() {}',
  '/labs/yearbook3/index.html':'Yearbook 3 · Student Lab',
  '/labs/yearbook3/logic.mjs':'export function submitEntry() {}',
 };
 return {ok:true,url:String(url),json:async()=>json,text:async()=>bodies[name]||''};
}
test('independent hosting configuration is at least three independent alternatives',()=>{
 assert.equal(registry.primary.provider,'Netlify');
 assert.deepEqual(registry.mirrors.map(x=>x.provider),['Vercel','Render','Cloudflare Pages']);
 assert.ok(registry.mirrors.every(x=>x.url===null));
 assert.equal(registry.rules.no_fake_green,true);
 assert.equal(registry.rules.no_auto_dns_cutover_without_external_provider_health_routing,true);
});
test('Vercel and Render require source gate before static artifact deploy',()=>{
 const vercel=JSON.parse(readFileSync(resolve(root,'vercel.json'),'utf8'));
 const render=readFileSync(resolve(root,'../../render.yaml'),'utf8');
 const netlify=readFileSync(resolve(root,'netlify.toml'),'utf8');
 assert.match(vercel.buildCommand,/build-proof\.mjs && node scripts\/prepare-mirror\.mjs/);
 assert.equal(vercel.outputDirectory,'mirror-dist');
 assert.match(render,/runtime: static/);
 assert.match(render,/staticPublishPath: \.\/engine\/dashboard\/mirror-dist/);
 assert.match(render,/node scripts\/prepare-mirror\.mjs/);
 assert.match(netlify,/node scripts\/build-proof\.mjs/);
});
test('working static source is checked by actual routes and exact SHA',async()=>{
 const out=await inspectMirror(base,{fetcher:async url=>mockSuccess(url),expectedSha:sha,now:()=> '2026-10-30T16:00:00Z'});
 assert.equal(out.state,'STATIC_SOURCE_VERIFIED');
 assert.equal(out.checks.build_proof.sha,sha);
 assert.equal(out.checks.static_assets,'PASSED');
 assert.equal(out.note.includes('Not proof'),true);
});
test('missing published automation proof is NOT a usable dashboard mirror',async()=>{
 const fetcher=async url=>{
   const r=mockSuccess(url);
   if(new URL(url).pathname==='/automation-proof.mjs')r.text=async()=>'';
   return r;
 };
 const out=await inspectMirror(base,{fetcher,expectedSha:sha});
 assert.equal(out.state,'RECOVERING');
 assert.equal(out.reason,'missing_or_stale_asset:automation-proof.mjs');
});
test('mirror build allowlist contains both automation proof assets',()=>{
 const source=readFileSync(resolve(root,'scripts/prepare-mirror.mjs'),'utf8');
 assert.match(source,/'automation-proof\\.mjs'/);
 assert.match(source,/'automation-proof\\.json'/);
});
test('different SHA never counts as healthy redundancy',async()=>{
 const out=await inspectMirror(base,{fetcher:async url=>mockSuccess(url),expectedSha:'b'.repeat(40)});
 assert.equal(out.state,'RECOVERING');
 assert.equal(out.reason,'source_sha_mismatch');
});
test('unsafe or missing URL cannot be a real host',async()=>{
 const a=await inspectMirror('http://localhost:3000');
 const b=await inspectMirror(null);
 assert.equal(a.state,'NOT_CONFIGURED');
 assert.equal(b.state,'NOT_CONFIGURED');
});
test('unconfigured failovers are not silently counted as green',async()=>{
 const out=await verifyFleet({config:{primary:null,mirrors:[{provider:'Vercel',url:null},{provider:'Render',url:null}]},fetcher:()=>{throw Error('network was not expected')}});
 assert.equal(out.healthy,0);
 assert.equal(out.fully_automated_failover_verified,false);
 assert.equal(out.hosts.length,3);
});

test('two green static hosts on different commits are NOT redundant',async()=>{
 const cfg={primary:{provider:'Netlify',url:'https://primary.example/'},
   mirrors:[{provider:'Vercel',url:'https://mirror.example/'}]};
 const fetcher=async url=>{
   const host=new URL(url).hostname;
   const r=mockSuccess(url);
   if(new URL(url).pathname==='/build-proof.json' && host==='mirror.example')
     r.json=async()=>({schema_version:1,build_tests:'PASSED',source_commit:'b'.repeat(40),verified_at:'2026-10-30T16:00:00Z'});
   if(new URL(url).pathname==='/mirror-manifest.json' && host==='mirror.example')
     r.json=async()=>({schema_version:1,source_commit:'b'.repeat(40)});
   return r;
 };
 const out=await verifyFleet({config:cfg,fetcher});
 assert.equal(out.healthy,1);
 assert.equal(out.hosts[1].state,'SOURCE_MISMATCH');
 assert.equal(out.fully_automated_failover_verified,false);
});
test('duplicate provider or duplicate origin cannot inflate static redundancy',async()=>{
 const cfg={primary:{provider:'Netlify',url:'https://primary.example/'},
   mirrors:[
     {provider:'Netlify',url:'https://mirror.example/'},
     {provider:'Vercel',url:'https://primary.example/'}
   ]};
 const out=await verifyFleet({config:cfg,fetcher:async url=>mockSuccess(url)});
 assert.equal(out.healthy,1);
 assert.equal(out.hosts[1].state,'DUPLICATE_OR_UNVERIFIED_HOST');
 assert.equal(out.hosts[2].state,'DUPLICATE_OR_UNVERIFIED_HOST');
 assert.equal(out.independently_authenticated_provider_identities_verified,false);
});
test('two distinct configured providers with same source SHA pass static checks, not DNS failover',async()=>{
 const cfg={primary:{provider:'Netlify',url:'https://primary.example/'},
   mirrors:[{provider:'Vercel',url:'https://mirror.example/'}]};
 const out=await verifyFleet({config:cfg,fetcher:async url=>mockSuccess(url)});
 assert.equal(out.healthy,2);
 assert.equal(out.common_source_sha,sha);
 assert.equal(out.source_matched_distinct_configured_providers,2);
 assert.equal(out.fully_automated_failover_verified,false);
});
