import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

test('single-writer journal fences a second active ticket for the same worker across restart',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zoo-one-worker-'));
  const file=join(dir,'queue.jsonl');
  let clock=100000;
  const make=()=>new DurableQueue(file,{now:()=>clock,leaseMs:100,maxAttempts:3});
  try{
    let q=make();
    q.create({id:'A',repo:'Zoodo',description:'First bounded task'});
    q.create({id:'B',repo:'Zoodo',description:'Second bounded task'});
    q.claim('A',{worker:'worker1',provider:'authenticated-provider'});
    assert.throws(()=>q.claim('B',{worker:'worker1',provider:'authenticated-provider'}),/already has active ticket/);
    assert.equal(q.get('B').attempts,0);
    q=make();
    assert.throws(()=>q.claim('B',{worker:'worker1',provider:'authenticated-provider'}),/already has active ticket/);
    clock+=101;
    assert.throws(()=>q.claim('B',{worker:'worker1',provider:'authenticated-provider'}),/already has active ticket/);
    assert.equal(q.recover().length,1);
    assert.equal(q.claim('B',{worker:'worker1',provider:'authenticated-provider'}).status,'assigned');
    assert.equal(make().get('B').attempts,1);
  }finally{rmSync(dir,{recursive:true,force:true})}
});
