import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';
test('expired worker cannot issue fail transition before lease reconciliation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zoo-stale-fail-'));
 try {
  let now=100000;
  const q=new DurableQueue(join(dir,'q.jsonl'),{now:()=>now,leaseMs:100});
  q.create({id:'A',repo:'Zoodo',description:'Ticket A'});
  q.claim('A',{worker:'w',provider:'p'});
  now+=101;
  assert.throws(()=>q.fail('A',{worker:'w',reason:'late failure callback'}),/No active lease/);
  assert.equal(q.get('A').status,'assigned');
  assert.equal(q.recover().length,1);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('current worker may report failure and release active lease',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zoo-active-fail-'));
 try {
  let now=100000;
  const q=new DurableQueue(join(dir,'q.jsonl'),{now:()=>now,leaseMs:100});
  q.create({id:'A',repo:'Zoodo',description:'Ticket A'});
  q.claim('A',{worker:'w',provider:'p'});
  assert.equal(q.fail('A',{worker:'w',reason:'native worker failure receipt'}).status,'queued');
  assert.equal(q.get('A').worker,null);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
