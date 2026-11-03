import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn, maxAttempts=3) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-claim-transition-'));
  const file=join(dir,'journal.jsonl');
  const make=()=>new DurableQueue(file,{now:()=>100000,leaseMs:100,maxAttempts});
  const inject=(type,id,fields={})=>appendFileSync(file,JSON.stringify({
    eventId:randomUUID(),type,id,at:new Date(100000).toISOString(),...fields
  })+'\n');
  try {return fn({file,make,inject})}
  finally {rmSync(dir,{recursive:true,force:true})}
}
function rejectWithoutMutation(make,file) {
  const original=readFileSync(file,'utf8');
  assert.throws(make,/Invalid journal claim transition/);
  assert.equal(readFileSync(file,'utf8'),original,'replay must preserve original evidence');
}

test('forged second claim cannot replace an assigned worker',()=>fixture(({file,make,inject})=>{
  const q=make();q.create({id:'T',repo:'Zoodo',description:'claim replay'});
  q.claim('T',{worker:'worker-1',provider:'builder'});
  inject('claim','T',{worker:'worker-2',provider:'builder',leaseUntil:100100});
  rejectWithoutMutation(make,file);
}));
test('forged second claim cannot replace a running worker',()=>fixture(({file,make,inject})=>{
  const q=make();q.create({id:'T',repo:'Zoodo',description:'claim replay'});
  q.claim('T',{worker:'worker-1',provider:'builder'});q.start('T','worker-1');
  inject('claim','T',{worker:'worker-2',provider:'builder',leaseUntil:100100});
  rejectWithoutMutation(make,file);
}));
test('replayed retry must not reuse a previous invocation identity',()=>fixture(({file,make,inject})=>{
  const q=make();q.create({id:'T',repo:'Zoodo',description:'claim replay'});
  q.claim('T',{worker:'worker-1',provider:'builder'});
  q.fail('T',{worker:'worker-1',reason:'retry'});
  inject('claim','T',{worker:'worker-1',provider:'builder',leaseUntil:100100});
  rejectWithoutMutation(make,file);
}));
test('replay cannot assign one active worker to two tickets',()=>fixture(({file,make,inject})=>{
  const q=make();q.create({id:'A',repo:'Zoodo',description:'first'});
  q.create({id:'B',repo:'Zoodo',description:'second'});
  q.claim('A',{worker:'worker-1',provider:'builder'});
  inject('claim','B',{worker:'worker-1',provider:'builder',leaseUntil:100100});
  rejectWithoutMutation(make,file);
}));
test('forged READY state cannot bypass exhausted attempt budget',()=>fixture(({file,make,inject})=>{
  const q=make();q.create({id:'T',repo:'Zoodo',description:'claim replay'});
  q.claim('T',{worker:'worker-1',provider:'builder'});
  q.fail('T',{worker:'worker-1',reason:'final failure'});
  inject('requeue','T',{dead:false,reason:'forged ready'});
  inject('claim','T',{worker:'worker-2',provider:'builder',leaseUntil:100100});
  rejectWithoutMutation(make,file);
},1));
test('legitimate fresh-worker retry survives journal restart',()=>fixture(({make})=>{
  const q=make();q.create({id:'T',repo:'Zoodo',description:'claim replay'});
  q.claim('T',{worker:'worker-1',provider:'builder'});
  q.fail('T',{worker:'worker-1',reason:'retry'});
  q.claim('T',{worker:'worker-2',provider:'builder'});
  const restored=make().get('T');
  assert.equal(restored.status,'assigned');
  assert.equal(restored.worker,'worker-2');
  assert.equal(restored.attempts,2);
}));
