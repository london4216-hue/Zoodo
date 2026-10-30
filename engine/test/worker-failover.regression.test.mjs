import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleReplacement, handoffAndReassign, recoverAndReassign} from '../src/worker-failover.mjs';

// These are simulated workers, NOT provider invocation receipts.
const receipt = 'https://github.com/example/actions/runs/123';
const workers = [
  {id:'w2', provider:'other-provider', repos:['Zoo','Other'], available:true, verified:true, invocationReceipt:receipt},
  {id:'w3', provider:'third-provider', repos:['Zoo','Other'], available:true, verified:true, invocationReceipt:receipt}
];
function fakeQueue() {
 const items=new Map();
 const q={
  list:()=>[...items.values()].map(x=>structuredClone(x)),
  get:id=>items.has(id)?structuredClone(items.get(id)):null,
  create:({id,repo,description})=>{
   if(items.has(id)){
    const t=items.get(id);
    if(t.repo!==repo || t.description!==description) throw Error('Idempotency collision');
    return structuredClone(t);
   }
   const t={id,repo,description,status:'queued',worker:null,provider:null,history:[{type:'create'}]};
   items.set(id,t);return structuredClone(t);
  },
  claim:(id,{worker,provider})=>{
   const t=items.get(id);if(t.status!=='queued')throw Error('Not queued');
   t.status='assigned';t.worker=worker;t.provider=provider;t.history.push({type:'claim',worker,provider});
   return structuredClone(t);
  },
  fail:(id,{worker,reason})=>{
   const t=items.get(id);if(t.worker!==worker)throw Error('Not owner');
   t.history.push({type:'requeue',worker,reason});t.worker=null;t.provider=null;t.status='queued';
   return structuredClone(t);
  },
  recover:()=>[],
 };
 return q;
}
function start(q,id,repo,worker='w1'){
 q.create({id,repo,description:'Implement bounded feature'});
 q.claim(id,{worker,provider:'original'});
}

test('busy worker must not be selected to own two simultaneously active tickets',()=>{
 const q=fakeQueue();start(q,'busy','Zoo','w2');start(q,'A','Zoo');
 const replacement=eligibleReplacement(q,q.get('A'),workers,'w1');
 assert.equal(replacement?.id,'w3');
 const outcome=handoffAndReassign(q,'A',{worker:'w1',reason:'timeout',receipt},workers);
 assert.equal(outcome.replacement,'w3');
 assert.equal(q.get('busy').worker,'w2');
});

test('no spare capacity leaves work queued instead of double-booking worker',()=>{
 const q=fakeQueue();start(q,'busy','Zoo','w2');start(q,'busy2','Zoo','w3');start(q,'A','Zoo');
 const outcome=handoffAndReassign(q,'A',{worker:'w1',reason:'timeout',receipt},workers);
 assert.equal(outcome.status,'queued-no-verified-capacity');
 assert.equal(q.get('A').status,'queued');
});

test('second handoff across repos keeps one seeker without idempotency collision',()=>{
 const q=fakeQueue();start(q,'A','Zoo');
 handoffAndReassign(q,'A',{worker:'w1',reason:'first',receipt},workers);
 start(q,'B','Other');
 const result=handoffAndReassign(q,'B',{worker:'w1',reason:'second',receipt},workers);
 assert.equal(result.seeker,'seeker:w1');
 assert.equal(q.get('seeker:w1').repo,'Other');
 start(q,'C','Zoo');
 q.fail('C',{worker:'w1',reason:'expired lease'});
 q.recover=()=>[{...q.get('C'),status:'queued',history:[...q.get('C').history,{type:'requeue',worker:'w1'}]}];
 assert.doesNotThrow(()=>recoverAndReassign(q,workers));
 assert.equal(q.list().filter(t=>t.id==='seeker:w1').length,1);
 assert.equal(q.get('seeker:w1').status,'queued');
});
