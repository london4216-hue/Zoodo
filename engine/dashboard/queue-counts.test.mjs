import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchOpenQueue} from './queue-counts.mjs';
test('one page with 95 mixed GitHub issues and PRs returns exact count', async()=>{
 const calls=[];
 const r=await fetchOpenQueue(async path=>{calls.push(path);return Array.from({length:95},(_,i)=>({number:i+1,pull_request:i>=25?{}:undefined}));},'/issues');
 assert.equal(r.items.filter(x=>!x.pull_request).length,25);
 assert.equal(r.items.length,95);
 assert.equal(r.complete,true);
 assert.deepEqual(calls,['/issues?state=open&per_page=100&page=1']);
});
test('paginates beyond first 100 without claiming a truncated total',async()=>{
 const calls=[];
 const r=await fetchOpenQueue(async path=>{calls.push(path);return Array.from({length:calls.length===1?100:7},(_,i)=>({number:i+1}));},'/pulls');
 assert.equal(r.items.length,107);assert.equal(r.complete,true);assert.equal(calls.length,2);
});
test('failed later page is an error rather than an inaccurate partial count',async()=>{
 let page=0;
 await assert.rejects(fetchOpenQueue(async()=>{if(++page===1)return Array.from({length:100},(_,i)=>i);throw Error('GitHub 403');},'/issues'),/403/);
});
test('hard page bound marks count as incomplete',async()=>{
 const r=await fetchOpenQueue(async()=>Array.from({length:100},(_,i)=>i),'/pulls',2);
 assert.equal(r.items.length,200);assert.equal(r.complete,false);
});
test('malformed API response cannot be counted',async()=>{
 await assert.rejects(fetchOpenQueue(async()=>({total_count:25}),'/issues'),/Malformed/);
});
test('unsupported endpoint is rejected',async()=>{
 await assert.rejects(fetchOpenQueue(async()=>[],'/commits'),/Unsupported/);
});
