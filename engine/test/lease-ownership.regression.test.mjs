import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

// These are simulated workers, NOT verified external provider invocations.
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'zoo-lease-'));let now=100000;
 const make=()=>new DurableQueue(join(dir,'journal.jsonl'),{now:()=>now,leaseMs:100,maxAttempts:4});
 try{return fn({make,advance:n=>now+=n})}finally{rmSync(dir,{recursive:true,force:true})}
}
function ticket(q,id){q.create({id,repo:'Zoo',description:'Bounded builder ticket'})}
test('queue refuses double-booking a live worker; unrelated worker proceeds',()=>fixture(({make})=>{
 const q=make();ticket(q,'A');ticket(q,'B');
 q.claim('A',{worker:'w1',provider:'p1'});
 assert.throws(()=>q.claim('B',{worker:'w1',provider:'p1'}),/active lease/);
 assert.equal(q.claim('B',{worker:'w2',provider:'p2'}).status,'assigned');
}));
test('journal replay preserves active worker exclusivity',()=>fixture(({make})=>{
 let q=make();ticket(q,'A');ticket(q,'B');q.claim('A',{worker:'w1',provider:'p1'});
 q=make();
 assert.throws(()=>q.claim('B',{worker:'w1',provider:'p1'}),/active lease/);
 assert.equal(q.get('B').status,'queued');
}));
test('expired owner cannot manually hand off; recover records one event',()=>fixture(({make,advance})=>{
 const q=make();ticket(q,'A');q.claim('A',{worker:'w1',provider:'p1'});
 advance(101);
 assert.throws(()=>q.fail('A',{worker:'w1',reason:'late handoff'}),/failure evidence/);
 assert.equal(q.get('A').history.filter(e=>e.type==='handoff').length,0);
 q.recover();
 assert.equal(q.get('A').history.filter(e=>e.type==='handoff').length,1);
 assert.deepEqual(q.recover(),[]);
}));
test('two empty handoffs fence normal work but permit bounded seeker',()=>fixture(({make})=>{
 let q=make();for(const id of ['A','B','C','seeker:w1'])ticket(q,id);
 for(const id of ['A','B']){
  q.claim(id,{worker:'w1',provider:'p1'});
  q.fail(id,{worker:'w1',reason:'no verified work'});
 }
 q=make();
 assert.throws(()=>q.claim('C',{worker:'w1',provider:'p1'}),/replacement-seeker/);
 assert.equal(q.claim('seeker:w1',{worker:'w1',provider:'p1'}).status,'assigned');
 assert.equal(q.get('C').status,'queued');
}));
