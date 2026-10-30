import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';
import {handoffAndReassign,recoverAndReassign,handoffCount,eligibleReplacement,acceptPanelResponse} from '../src/worker-failover.mjs';

const receipt='https://github.com/example/repo/actions/runs/123';
const workers=[
  {id:'w2',provider:'provider2',repos:['Zoo'],available:true,verified:true,invocationReceipt:receipt},
  {id:'w3',provider:'provider3',repos:['Zoo'],available:true,verified:true,invocationReceipt:receipt}
];
function fixture(fn,{maxAttempts=4}={}){
 const dir=mkdtempSync(join(tmpdir(),'zoo-failover-'));let now=100000;
 const make=()=>new DurableQueue(join(dir,'queue.jsonl'),{now:()=>now,leaseMs:100,maxAttempts});
 try{return fn({make,advance:n=>now+=n})}finally{rmSync(dir,{recursive:true,force:true})}
}
const makeTicket=(q,id='A',worker='w1',provider='provider1')=>{
 q.create({id,repo:'Zoo',description:'Bounded implementation with acceptance'});
 q.claim(id,{worker,provider});q.start(id,worker);
};
test('rejects unverified, missing, incompatible and self replacements',()=>fixture(({make})=>{
 const q=make();makeTicket(q);
 assert.equal(eligibleReplacement(q,q.get('A'),[{...workers[0],verified:false}, {...workers[1],repos:['Other']}],'w1'),null);
 assert.equal(eligibleReplacement(q,q.get('A'),[{...workers[0],id:'w1'}],'w1'),null);
 assert.equal(eligibleReplacement(q,q.get('A'),workers,'w1').id,'w2');
}));
test('one handoff logs evidence and immediately claims verified replacement',()=>fixture(({make})=>{
 let q=make();makeTicket(q);
 const r=handoffAndReassign(q,'A',{worker:'w1',reason:'provider unavailable',receipt},workers);
 assert.equal(r.status,'assigned');assert.equal(r.replacement,'w2');assert.equal(r.seeker,null);
 assert.equal(handoffCount(q,'w1'),1);assert.match(q.get('A').history.at(-2).reason,/provider unavailable/);
 q=make();assert.equal(q.get('A').worker,'w2');assert.equal(q.list().length,1);
}));
test('two handoffs move worker to a single bounded seeker ticket, never mark it running',()=>fixture(({make})=>{
 let q=make();makeTicket(q,'A');
 handoffAndReassign(q,'A',{worker:'w1',reason:'handoff one',receipt},workers);
 makeTicket(q,'B','w1','provider1');
 const r=handoffAndReassign(q,'B',{worker:'w1',reason:'handoff two',receipt},workers);
 assert.equal(r.seeker,'seeker:w1');assert.equal(q.get('seeker:w1').status,'queued');
 assert.equal(handoffCount(q,'w1'),2);assert.equal(q.list().length,3);
 assert.equal(eligibleReplacement(q,q.get('B'),[{id:'w1',provider:'provider1',repos:['Zoo'],available:true,verified:true,invocationReceipt:receipt}],'w2'),null);
 q=make();assert.equal(q.get('seeker:w1').status,'queued');
 assert.equal(q.list().filter(x=>x.id==='seeker:w1').length,1);
}));
test('missing capacity leaves ticket queued, not a fictitious running agent',()=>fixture(({make})=>{
 const q=make();makeTicket(q);
 const r=handoffAndReassign(q,'A',{worker:'w1',reason:'provider down',receipt},[{...workers[0],available:false}]);
 assert.equal(r.status,'queued-no-verified-capacity');assert.equal(r.replacement,null);assert.equal(q.get('A').status,'queued');
}));
test('simulated lease loss is recovered and claimed without duplicate ticket',()=>fixture(({make,advance})=>{
 let q=make();makeTicket(q);advance(101);q=make();
 const [r]=recoverAndReassign(q,workers);
 assert.equal(r.replacement,'w2');assert.equal(q.get('A').attempts,2);assert.equal(q.list().length,1);
}));
test('exhausted retries block only affected ticket, other ticket remains actionable',()=>fixture(({make})=>{
 const q=make();makeTicket(q,'A');q.create({id:'B',repo:'Zoo',description:'Independent safe task'});
 const r=handoffAndReassign(q,'A',{worker:'w1',reason:'failed',receipt},workers);
 assert.equal(r.status,'blocked');assert.equal(q.get('B').status,'queued');
},{maxAttempts:1}));
test('invalid evidence and non-owner handoff fail closed',()=>fixture(({make})=>{
 const q=make();makeTicket(q);
 assert.throws(()=>handoffAndReassign(q,'A',{worker:'w1',reason:'oops',receipt:'not-a-link'},workers),/evidence/);
 assert.throws(()=>handoffAndReassign(q,'A',{worker:'other',reason:'oops',receipt},workers),/owner/);
 assert.equal(q.get('A').status,'running');
}));
test('panel rejects fabricated, fewer than three or duplicate proposals',()=>{
 const proposal=i=>({id:`p${i}`,change:`Change ${i}`,acceptanceTest:'Failover regression',cost:'Bounded cost',security:'Least privilege'});
 const payload={provider:'model',verified:true,invocationReceipt:receipt,proposals:[proposal(1),proposal(2),proposal(3)]};
 assert.equal(acceptPanelResponse(payload).status,'response-receipt-supplied-needs-independent-audit');
 assert.throws(()=>acceptPanelResponse({...payload,verified:false}),/Verified/);
 assert.throws(()=>acceptPanelResponse({...payload,proposals:payload.proposals.slice(0,2)}),/Exactly three/);
 assert.throws(()=>acceptPanelResponse({...payload,proposals:[proposal(1),proposal(1),proposal(3)]}),/distinct/);
});
