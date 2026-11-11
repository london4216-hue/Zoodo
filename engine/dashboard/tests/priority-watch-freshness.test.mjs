import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../priority-watch.mjs',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const snapshot=(iso,stage)=>({schema_version:1,source:'authenticated_github_connector_read',observed_at:iso,priority:{stage,last_test:{state:'UNKNOWN'}},sara:{state:'UNKNOWN'},dashboard:{production_verified:false}});
function setup(fetch){
 const elements=new Map();
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{textContent:'',addEventListener(){}});return elements.get(id)}};
 const ctx=vm.createContext({document,fetch,setInterval(){},Date,String,Error,Number,Math,AbortSignal:{timeout:ms=>({timeoutMs:ms})}});
 vm.runInContext(script,ctx);
 return {ctx,elements};
}
test('older cached priority feed cannot replace newer source evidence',async()=>{
 const now=Date.now(),newer=new Date(now-60000).toISOString(),older=new Date(now-3600000).toISOString();
 let next=snapshot(newer,'NEWER_SOURCE');
 const {ctx,elements}=setup(async()=>({ok:true,json:async()=>next}));
 await tick();
 assert.equal(elements.get('zoo787stage').textContent,'NEWER_SOURCE');
 next=snapshot(older,'REPLAYED_OLD_SOURCE');
 await vm.runInContext('refreshPriority()',ctx);
 assert.equal(elements.get('zoo787stage').textContent,'RECOVERING');
 assert.match(elements.get('zooPriorityReceipt').textContent,/regressed/i);
 assert.match(elements.get('zooPriorityReceipt').textContent,/last valid snapshot/);
 assert.doesNotMatch(elements.get('zoo787stage').textContent,/REPLAYED/);
});
test('manual and periodic refreshes do not overlap pending priority fetch',async()=>{
 let count=0,release;
 const pending=new Promise(resolve=>release=resolve);
 const {ctx}=setup(async()=>{count++;await pending;return {ok:true,json:async()=>snapshot(new Date(Date.now()-1000).toISOString(),'CURRENT')}});
 const concurrent=vm.runInContext('refreshPriority()',ctx);
 await tick();
 const wasSerialized=count===1;
 release();await concurrent;await tick();
 assert.equal(wasSerialized,true,'concurrent refresh must not issue second request');
 await vm.runInContext('refreshPriority()',ctx);
 assert.equal(count,2);
});
test('priority feed request has a bounded timeout signal',async()=>{
 let signal;
 setup(async(_url,opts)=>{signal=opts.signal;return {ok:true,json:async()=>snapshot(new Date(Date.now()-1000).toISOString(),'CURRENT')}});
 await tick();
 assert.equal(signal?.timeoutMs,10000);
});
