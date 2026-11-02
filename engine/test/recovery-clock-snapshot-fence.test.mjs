import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-recovery-clock-'));
  let clock=1000,sequence=null;
  const now=()=>sequence?.length?sequence.shift():clock;
  try {
    const file=join(dir,'queue.jsonl');
    const q=new DurableQueue(file,{now,leaseMs:100});
    q.create({id:'A',repo:'Zoodo',description:'first lease'});
    q.create({id:'B',repo:'Zoodo',description:'second lease'});
    q.claim('A',{worker:'worker-a',provider:'provider-a'});
    q.claim('B',{worker:'worker-b',provider:'provider-b'});
    return fn({q,file,setClock:x=>{clock=x;},setSequence:x=>{sequence=[...x];}});
  } finally {rmSync(dir,{recursive:true,force:true});}
}

test('invalid infinite recovery clock cannot prematurely requeue active workers',()=>fixture(({q,file,setClock})=>{
  const before=readFileSync(file,'utf8');
  setClock(Infinity);
  assert.throws(()=>q.recover(),/Invalid recovery clock/);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('A').status,'assigned');
  assert.equal(q.get('B').status,'assigned');
}));

test('NaN recovery clock fails explicitly without changing durable journal',()=>fixture(({q,file,setClock})=>{
  const before=readFileSync(file,'utf8');
  setClock(NaN);
  assert.throws(()=>q.recover(),/Invalid recovery clock/);
  assert.equal(readFileSync(file,'utf8'),before);
}));

test('recovery uses one time snapshot across multiple active tickets',()=>fixture(({q,file,setSequence})=>{
  const before=readFileSync(file,'utf8');
  setSequence([1099,9999,9999,9999]);
  assert.deepEqual(q.recover(),[]);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('A').status,'assigned');
  assert.equal(q.get('B').status,'assigned');
}));

test('valid expiry still releases all eligible tickets',()=>fixture(({q,setClock})=>{
  setClock(1100);
  assert.equal(q.recover().length,2);
  assert.equal(q.get('A').status,'queued');
  assert.equal(q.get('B').status,'queued');
}));
