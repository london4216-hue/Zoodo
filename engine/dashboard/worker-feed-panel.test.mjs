import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./worker-feed-panel.mjs', import.meta.url),'utf8').replace(/^import \{evaluateWorkerFeed\} from '\.\/worker-feed\.mjs';/m,'');
const at='2026-11-01T13:45:00.000Z';
const older='2026-11-01T13:40:00.000Z';
const valid=(time=at)=>({schema_version:1,source:'zoo-worker-receipts',observed_at:time,workers:[{worker_id:'aider-local',state:'running',proof:'NATIVE_RECEIPT_REPORTED',observed_at:time,task_id:'T1'}]});
function harness(){
 const els=new Map(), calls=[];
 const doc={getElementById(id){if(!els.has(id))els.set(id,{textContent:'',children:[],replaceChildren(){this.children=[]},append(x){this.children.push(x)}});return els.get(id)},createElement(){return {children:[],textContent:'',append(x){this.children.push(x)}}}};
 const responses=[];
 const context=vm.createContext({document:doc,Map,Date,String,AbortSignal:{timeout:()=>null},setInterval(){},fetch:async()=>{const r=responses.shift();if(!r)throw Error('No fixture');return r},evaluateWorkerFeed(feed){if(!feed)return {state:'UNKNOWN',reason:'missing',observed_at:null,workers:[]};return {state:'RECEIPTS REPORTED',reason:'native claim only',observed_at:feed.observed_at,workers:feed.workers.map(w=>({...w}))}},console});
 // prevent automatic refresh from consuming a test fixture
 vm.runInContext(source.replace(/refresh\(\);setInterval\(refresh,30000\);/,'') ,context);
 const run=async(res)=>{responses.push(res);await vm.runInContext('refresh()',context)};
 const status=()=>els.get('worker-feed-status').textContent;
 const firstWorkerState=()=>els.get('worker-feed-rows').children[0]?.children[1]?.textContent;
 return {run,status,firstWorkerState,els};
}
test('a previously current running receipt becomes UNKNOWN when refresh fails',async()=>{
 const h=harness();await h.run({ok:true,json:async()=>valid()});
 assert.equal(h.firstWorkerState(),'RUNNING');
 await h.run({ok:false,status:503});
 assert.equal(h.firstWorkerState(),'UNKNOWN');
 assert.match(h.status(),/RECOVERY|UNKNOWN/);
});
test('an older cached snapshot cannot replace a newer worker receipt',async()=>{
 const h=harness();await h.run({ok:true,json:async()=>valid()});
 await h.run({ok:true,json:async()=>valid(older)});
 assert.equal(h.firstWorkerState(),'UNKNOWN');
 assert.match(h.status(),/regress|RECOVERY/i);
});
test('malformed feed cannot be presented as running',async()=>{
 const h=harness();await h.run({ok:true,json:async()=>valid()});
 await h.run({ok:true,json:async()=>({schema_version:1,source:'bad',observed_at:at,workers:[]})});
 assert.equal(h.firstWorkerState(),'UNKNOWN');
});
