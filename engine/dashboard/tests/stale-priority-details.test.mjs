import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../priority-watch.mjs',import.meta.url),'utf8');
const observed=new Date().toISOString();
const snapshot={schema_version:1,source:'authenticated_github_connector_read',observed_at:observed,
 priority:{stage:'MERGED',source_head_sha:'abcdef123456',responsible_worker:'Builder',last_test:{state:'PASS'},last_meaningful_update_at:observed},
 sara:{state:'VERIFIED',url:'https://example.com/sara',last_verified_at:observed},dashboard:{production_verified:true}};
async function scenario(failure){
 const nodes=new Map();let calls=0;
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',addEventListener(){}});return nodes.get(id)}};
 const fetch=async()=>{calls++;if(calls===1)return {ok:true,json:async()=>snapshot};if(failure==='http')return {ok:false,status:503};if(failure==='schema')return {ok:true,json:async()=>({...snapshot,source:'untrusted'})};throw Error('network failed')};
 const ctx=vm.createContext({document,fetch,Date,console,setInterval(){}});
 vm.runInContext(source,ctx);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(nodes.get('zoo787detail').textContent,/abcdef123456/);
 assert.match(nodes.get('zooSaraDetail').textContent,/https:\/\/example.com\/sara/);
 await vm.runInContext('refreshPriority()',ctx);
 return Object.fromEntries([...nodes].map(([k,v])=>[k,v.textContent]));
}
for(const failure of ['http','network','schema'])test('clears stale PR and Sara details on '+failure+' feed failure',async()=>{
 const n=await scenario(failure);
 assert.equal(n.zoo787stage,'RECOVERING');
 assert.equal(n.zooSaraState,'UNKNOWN');
 assert.doesNotMatch(n.zoo787detail,/abcdef123456|Builder|PASS/);
 assert.doesNotMatch(n.zooSaraDetail,/example.com|Verified URL/);
 assert.match(n.zoo787drift,/UNKNOWN/);
 assert.match(n.zooPriorityReceipt,/PRIORITY FEED UNAVAILABLE/);
});
