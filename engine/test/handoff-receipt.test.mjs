import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';
import {handoffAndReassign,handoffCount,recoverAndReassign} from '../src/worker-failover.mjs';

const receipt='https://github.com/example/actions/runs/123';
const candidate={id:'replacement',provider:'different',repos:['Zoo'],available:true,verified:true,invocationReceipt:receipt};
function fixture(fn){
 const dir=mkdtempSync(join(tmpdir(),'zoo-handoff-'));let clock=100000;
 const file=join(dir,'journal.jsonl');
 const make=()=>new DurableQueue(file,{now:()=>clock,leaseMs:100,maxAttempts:4});
 try{return fn({make,advance:ms=>clock+=ms})}
 finally{rmSync(dir,{recursive:true,force:true})}
}
function assigned(q,id,worker='builder'){
 q.create({id,repo:'Zoo',description:'Implement verified bounded work'});
 q.claim(id,{worker,provider:'original'});q.start(id,worker);
}
test('worker handoff is one durable journal event with explicit provenance',()=>fixture(({make,advance})=>{
 let q=make();assigned(q,'A');advance(42);
 const result=handoffAndReassign(q,'A',{worker:'builder',reason:'provider timeout',receipt},[candidate]);
 assert.equal(result.replacement,'replacement');
 const handoffs=q.get('A').history.filter(e=>e.type==='handoff');
 assert.equal(handoffs.length,1);
 const h=handoffs[0];
 assert.equal(h.reason,'provider timeout');assert.equal(h.receipt,receipt);
 assert.equal(h.worker,'builder');assert.equal(h.provider,'original');
 assert.equal(h.attempt,1);assert.equal(h.elapsedMs,42);
 assert.equal(h.costUsd,null);assert.equal(h.artifactReceipt,null);assert.equal(h.testReceipt,null);
 assert.equal(h.disposition,'worker-failure');assert.equal(h.dead,false);
 q=make();assert.equal(q.get('A').history.filter(e=>e.type==='handoff').length,1);
 assert.equal(handoffCount(q,'builder'),1);
}));
test('expired lease writes handoff once, replay does not double-count',()=>fixture(({make,advance})=>{
 let q=make();assigned(q,'B');advance(101);q=make();
 const [r]=recoverAndReassign(q,[candidate]);
 assert.equal(r.replacement,'replacement');
 const h=q.get('B').history.find(e=>e.type==='handoff');
 assert.equal(h.disposition,'lease-expired');assert.equal(h.receipt,null);
 assert.equal(h.costUsd,null);assert.equal(handoffCount(q,'builder'),1);
 assert.deepEqual(recoverAndReassign(q,[candidate]),[]);
 assert.equal(make().get('B').history.filter(e=>e.type==='handoff').length,1);
}));
test('independent NO-GO is not counted as worker handoff',()=>fixture(({make})=>{
 const q=make();assigned(q,'C');
 q.submit('C','builder',{commit:'a'.repeat(40),evidence:receipt});
 q.approve('C',{reviewer:'reviewer',provider:'independent',commit:'a'.repeat(40),evidence:receipt,approved:false});
 assert.equal(handoffCount(q,'builder'),0);
 assert.equal(q.get('C').history.filter(e=>e.type==='handoff').length,0);
 assert.equal(q.get('C').status,'queued');
}));
test('second nonproductive handoff produces one queued seeker with separate receipts',()=>fixture(({make})=>{
 const q=make();assigned(q,'D');handoffAndReassign(q,'D',{worker:'builder',reason:'first',receipt},[candidate]);
 assigned(q,'E');const r=handoffAndReassign(q,'E',{worker:'builder',reason:'second',receipt},[candidate]);
 assert.equal(r.seeker,'seeker:builder');assert.equal(handoffCount(q,'builder'),2);
 assert.equal(q.get('seeker:builder').status,'queued');
 assert.equal(q.list().filter(t=>t.id==='seeker:builder').length,1);
}));
