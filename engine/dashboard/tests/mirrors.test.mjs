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
