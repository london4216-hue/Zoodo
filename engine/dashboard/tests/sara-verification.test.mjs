import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../priority-watch.mjs',import.meta.url),'utf8');
const observed=new Date().toISOString();
async function display(sara){
 const nodes=new Map();
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',addEventListener(){}});return nodes.get(id)}};
 const feed={schema_version:1,source:'authenticated_github_connector_read',observed_at:observed,
  priority:{stage:'DRAFT',last_meaningful_update_at:observed},sara,dashboard:{production_verified:false}};
 const fetch=async()=>({ok:true,json:async()=>feed});
 runInNewContext(source,{document,fetch,setInterval(){},Date,URL,console});
 for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
 return nodes.get('zooSaraDetail')?.textContent;
}
test('rejects unsafe URL despite last_verified_at',async()=>{
 const s=await display({state:'VERIFIED',url:'javascript:alert(1)',last_verified_at:observed});
 assert.match(s,/URL (UNKNOWN|NOT RECENTLY VERIFIED)/);
 assert.doesNotMatch(s,/Verified URL:/);
});
test('rejects stale verification even if URL is HTTPS',async()=>{
 const s=await display({state:'VERIFIED',url:'https://example.com/demo',last_verified_at:'2026-10-30T01:00:00Z'});
 assert.doesNotMatch(s,/Verified URL:/);
});
test('rejects unverified state even with fresh timestamp',async()=>{
 const s=await display({state:'UNKNOWN',url:'https://example.com/demo',last_verified_at:observed});
 assert.doesNotMatch(s,/Verified URL:/);
});
test('labels a recent HTTPS receipt as source-reported, not independent browser proof',async()=>{
 const s=await display({state:'VERIFIED',url:'https://example.com/demo',last_verified_at:observed});
 assert.match(s,/Source-reported URL: https:\/\/example.com\/demo/);
 assert.match(s,/browser readback not independently verified/);
});
test('rejects future-dated verification receipts',async()=>{
 const future=new Date(Date.now()+10*60000).toISOString();
 const s=await display({state:'VERIFIED',url:'https://example.com/demo',last_verified_at:future});
 assert.doesNotMatch(s,/Source-reported URL:/);
});
test('rejects credential-bearing HTTPS URLs',async()=>{
 const s=await display({state:'VERIFIED',url:'https://user:password@example.com/demo',last_verified_at:observed});
 assert.doesNotMatch(s,/Source-reported URL:/);
});
