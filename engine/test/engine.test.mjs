import test from 'node:test';import assert from 'node:assert/strict';import {runTask,summarize} from '../src/engine.mjs';
test('fails over and requires independent provider approval',async()=>{const r=await runTask({task:{id:'1'},builders:[{id:'a',provider:'one',build:async()=>{throw Error('refused')}},{id:'b',provider:'two',build:async()=>({commit:'abc',costUsd:0.12})}],reviewers:[{id:'c',provider:'three',review:async()=>({approved:true,commit:'abc',costUsd:0.03})}]});assert.equal(r.status,'agreed');assert.equal(r.commit,'abc');assert.equal(r.events.filter(e=>e.kind==='failed').length,1);assert.equal(summarize(r.events).b.knownCostUsd,0.12)});
test('same-provider reviewer cannot approve',async()=>{const r=await runTask({task:{id:'2'},builders:[{id:'a',provider:'one',build:async()=>({commit:'abc'})}],reviewers:[{id:'b',provider:'one',review:async()=>({approved:true,commit:'abc'})}]});assert.equal(r.status,'blocked')});

test('independent reviewer outage fails over to another provider',async()=>{
 const r=await runTask({task:{id:'review-failover'},builders:[{id:'builder',provider:'one',build:async()=>({commit:'def'})}],reviewers:[{id:'review1',provider:'two',review:async()=>{throw Error('rate limited')}},{id:'review2',provider:'three',review:async()=>({approved:true,commit:'def'})}]});
 assert.equal(r.status,'agreed');assert.equal(r.events.filter(e=>e.kind==='review_failed').length,1);assert.equal(r.events.filter(e=>e.kind==='reviewed').length,1);
});
test('independent rejection cannot be bypassed by shopping for approval',async()=>{
 let secondCalled=false;
 const r=await runTask({task:{id:'reject'},builders:[{id:'builder',provider:'one',build:async()=>({commit:'ghi'})}],reviewers:[{id:'review1',provider:'two',review:async()=>({approved:false,commit:'ghi'})},{id:'review2',provider:'three',review:async()=>{secondCalled=true;return {approved:true,commit:'ghi'}}}]});
 assert.equal(r.status,'rejected');assert.equal(secondCalled,false);
});
test('all reviewer outages block without fabricating approval',async()=>{
 const r=await runTask({task:{id:'outage'},builders:[{id:'builder',provider:'one',build:async()=>({commit:'jkl'})}],reviewers:[{id:'review1',provider:'two',review:async()=>{throw Error('offline')}}]});
 assert.equal(r.status,'blocked');assert.equal(r.events.some(e=>e.kind==='reviewed'),false);
});

test('mismatched commit approval rejects and never shops for approval',async()=>{
 let second=false;
 const r=await runTask({task:{id:'mismatch'},builders:[{id:'builder',provider:'one',build:async()=>({commit:'aabb'})}],reviewers:[{id:'bad',provider:'two',review:async()=>({approved:true,commit:'different'})},{id:'next',provider:'three',review:async()=>{second=true;return {approved:true,commit:'aabb'}}}]});
 assert.equal(r.status,'rejected');assert.equal(second,false);assert.equal(r.events.find(e=>e.kind==='reviewed').approved,false);
});
test('missing reviewed commit cannot approve',async()=>{
 const r=await runTask({task:{id:'missing'},builders:[{id:'b',provider:'one',build:async()=>({commit:'aabb'})}],reviewers:[{id:'r',provider:'two',review:async()=>({approved:true})}]});
 assert.equal(r.status,'rejected');
});
test('malformed reviewer response fails over to independent provider',async()=>{
 const r=await runTask({task:{id:'malformed'},builders:[{id:'b',provider:'one',build:async()=>({commit:'aabb'})}],reviewers:[{id:'r1',provider:'two',review:async()=>({commit:'aabb'})},{id:'r2',provider:'three',review:async()=>({approved:true,commit:'aabb'})}]});
 assert.equal(r.status,'agreed');assert.equal(r.events.filter(e=>e.kind==='review_failed').length,1);
});
