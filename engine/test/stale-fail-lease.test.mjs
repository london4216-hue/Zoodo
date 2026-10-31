import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

test('expired worker cannot issue a stale failure event; recovery owns the requeue',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zoo-stale-fail-'));
  let clock=100000;
  const file=join(dir,'journal.jsonl');
  const make=()=>new DurableQueue(file,{now:()=>clock,leaseMs:100});
  try{
    const q=make();
    q.create({id:'A',repo:'Zoodo',description:'Failover guard'});
    q.claim('A',{worker:'old',provider:'provider-one'});
    q.start('A','old');
    clock+=101;
    assert.throws(()=>q.fail('A',{worker:'old',reason:'stale failure after expiry'}),/No active lease/);
    assert.equal(q.get('A').status,'running');
    assert.equal(make().recover()[0].status,'queued');
    const fresh=make();
    fresh.claim('A',{worker:'new',provider:'provider-two'});
    assert.equal(fresh.get('A').attempts,2);
    assert.throws(()=>fresh.fail('A',{worker:'old',reason:'late failure'}),/failure evidence|No active lease/);
    assert.equal(make().get('A').worker,'new');
  }finally{rmSync(dir,{recursive:true,force:true})}
});

test('current lease holder can still fail and immediately requeue for replacement',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zoo-current-fail-'));
  try{
    const q=new DurableQueue(join(dir,'journal.jsonl'),{now:()=>100000,leaseMs:100});
    q.create({id:'B',repo:'Zoodo',description:'Immediate replacement'});
    q.claim('B',{worker:'first',provider:'one'});
    assert.equal(q.fail('B',{worker:'first',reason:'worker failed'}).status,'queued');
    assert.equal(q.claim('B',{worker:'replacement',provider:'two'}).status,'assigned');
  }finally{rmSync(dir,{recursive:true,force:true})}
});
