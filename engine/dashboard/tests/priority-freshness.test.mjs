import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../priority-watch.mjs',import.meta.url),'utf8');
const snapshot=(observed_at)=>({schema_version:1,source:'authenticated_github_connector_read',observed_at,
 priority:{stage:'DRAFT_PR_OPEN_CONFLICTED',source_head_sha:'a'.repeat(40),responsible_worker:'UNKNOWN',last_test:{state:'UNKNOWN'},last_meaningful_update_at:observed_at},
 sara:{state:'UNKNOWN',url:null,last_verified_at:null},dashboard:{production_verified:false}});
async function render(feed){
 const elements=new Map();
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{textContent:'',addEventListener(){}});return elements.get(id);}};
 const ctx=vm.createContext({document,fetch:async()=>({ok:true,json:async()=>feed}),setInterval(){},Date,Number,Math,String,Error});
 vm.runInContext(script,ctx);
 await vm.runInContext('refreshPriority()',ctx);
 return id=>elements.get(id).textContent;
}
test('old priority snapshot cannot masquerade as current PR or Sara status',async()=>{
 const read=await render(snapshot(new Date(Date.now()-16*3600000).toISOString()));
 assert.match(read('zoo787stage'),/STALE SNAPSHOT/);
 assert.match(read('zoo787detail'),/Last recorded stage DRAFT_PR_OPEN_CONFLICTED/);
 assert.equal(read('zooSaraState'),'STALE SNAPSHOT');
 assert.match(read('zooPriorityReceipt'),/current PR\/Sara status UNKNOWN/);
});
test('fresh priority snapshot keeps recorded stage but not worker claims',async()=>{
 const read=await render(snapshot(new Date(Date.now()-2*60000).toISOString()));
 assert.equal(read('zoo787stage'),'DRAFT_PR_OPEN_CONFLICTED');
 assert.equal(read('zooSaraState'),'UNKNOWN');
 assert.match(read('zoo787drift'),/Last VERIFIED meaningful task movement: UNKNOWN/);
});
test('future-dated source is rejected',async()=>{
 const read=await render(snapshot(new Date(Date.now()+5*60000).toISOString()));
 assert.equal(read('zoo787stage'),'RECOVERING');
 assert.match(read('zooPriorityReceipt'),/invalid source timestamp/);
});
