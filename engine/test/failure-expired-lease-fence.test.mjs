import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-expired-failure-'));
  let now=100000;
  try {
    const file=join(dir,'queue.jsonl');
    const q=new DurableQueue(file,{now:()=>now,leaseMs:1000});
    q.create({id:'T1',repo:'Zoodo',description:'lease failure fence'});
    q.claim('T1',{worker:'invocation-1',provider:'provider-a'});
    return fn({q,file,setNow:n=>{now=n;}});
  } finally {rmSync(dir,{recursive:true,force:true});}
}

test('expired assigned worker cannot write failure/requeue before recovery',()=>fixture(({q,file,setNow})=>{
  setNow(101000);
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.fail('T1',{worker:'invocation-1',reason:'late transport failure'}),/active lease/i);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('T1').status,'assigned');
  assert.equal(q.recover().length,1);
  assert.equal(q.claim('T1',{worker:'invocation-2',provider:'provider-b'}).status,'assigned');
}));

test('expired running worker cannot write failure/requeue before recovery',()=>fixture(({q,file,setNow})=>{
  q.start('T1','invocation-1');
  setNow(101001);
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.fail('T1',{worker:'invocation-1',reason:'late worker callback'}),/active lease/i);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('T1').status,'running');
}));

test('valid in-lease worker failure still releases ticket for next invocation',()=>fixture(({q})=>{
  assert.equal(q.fail('T1',{worker:'invocation-1',reason:'worker error'}).status,'queued');
  assert.equal(q.claim('T1',{worker:'invocation-2',provider:'provider-b'}).status,'assigned');
}));
