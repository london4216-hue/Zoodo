import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

// Simulated queue owners; NOT real external worker/provider invocations.
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'zoo-seeker-'));let now=100000;
 const make=()=>new DurableQueue(join(dir,'journal.jsonl'),{now:()=>now,leaseMs:100,maxAttempts:4});
 try{return fn({make,advance:n=>now+=n})}finally{rmSync(dir,{recursive:true,force:true})}
}
function strike(q,worker,id){
 q.create({id,repo:'Zoodo',description:'Bounded builder ticket'});
 q.claim(id,{worker,provider:'p1'});
 q.fail(id,{worker,reason:'No verified artifact'});
}
test('only the named, twice-struck worker can claim its seeker ticket',()=>fixture(({make})=>{
 const q=make();strike(q,'w1','A');strike(q,'w1','B');
 q.create({id:'seeker:w1',repo:'Zoodo',description:'Bounded replacement research'});
 assert.throws(()=>q.claim('seeker:w1',{worker:'w2',provider:'p2'}),/seeker owner/);
 assert.equal(q.claim('seeker:w1',{worker:'w1',provider:'p1'}).status,'assigned');
}));
test('unrestricted worker cannot self-promote to seeker role',()=>fixture(({make})=>{
 const q=make();q.create({id:'seeker:w2',repo:'Zoodo',description:'Bounded replacement research'});
 assert.throws(()=>q.claim('seeker:w2',{worker:'w2',provider:'p2'}),/two handoffs/);
 assert.equal(q.get('seeker:w2').status,'queued');
}));
test('seeker has one attempt and expired seeker is blocked, never retried indefinitely',()=>fixture(({make,advance})=>{
 let q=make();strike(q,'w1','A');strike(q,'w1','B');
 q.create({id:'seeker:w1',repo:'Zoodo',description:'Bounded replacement research'});
 q.claim('seeker:w1',{worker:'w1',provider:'p1'});advance(101);
 q.recover();q=make();
 assert.equal(q.get('seeker:w1').status,'blocked');
 assert.throws(()=>q.claim('seeker:w1',{worker:'w1',provider:'p1'}),/not queued/);
 assert.equal(q.create({id:'C',repo:'Zoodo',description:'Unrelated work'}).status,'queued');
}));
