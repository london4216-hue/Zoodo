import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-worker-reuse-'));
  const file=join(dir,'queue.jsonl');
  let clock=100000;
  const make=()=>new DurableQueue(file,{now:()=>clock,leaseMs:100,maxAttempts:3});
  try {fn({make,advance:n=>clock+=n,file});} finally {rmSync(dir,{recursive:true,force:true});}
}

test('expired invocation identity cannot be reused for same ticket after recovery/restart',()=>fixture(({make,advance,file})=>{
  let q=make();
  q.create({id:'A',repo:'Zoodo',description:'Fenced recovery'});
  q.claim('A',{worker:'invocation-1',provider:'builder'});
  q.start('A','invocation-1');
  advance(101);
  assert.equal(q.recover()[0].status,'queued');
  q=make();
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.claim('A',{worker:'invocation-1',provider:'builder'}),/Fresh worker invocation required/);
  assert.equal(readFileSync(file,'utf8'),before,'rejected reuse must not append a claim');
  assert.equal(q.get('A').attempts,1);
  assert.equal(q.claim('A',{worker:'invocation-2',provider:'builder'}).attempts,2);
  q.start('A','invocation-2');
  assert.throws(()=>q.submit('A','invocation-1',{commit:'a'.repeat(40),evidence:'old callback'}),/No active lease/);
}));

test('rejected-review retry requires a fresh worker invocation but may use same provider',()=>fixture(({make})=>{
  const q=make();
  q.create({id:'B',repo:'Zoodo',description:'Retry after review'});
  q.claim('B',{worker:'attempt-1',provider:'builder'});
  q.start('B','attempt-1');
  q.submit('B','attempt-1',{commit:'a'.repeat(40),evidence:'PR'});
  q.approve('B',{reviewer:'independent',provider:'review',commit:'a'.repeat(40),evidence:'review',approved:false});
  assert.throws(()=>q.claim('B',{worker:'attempt-1',provider:'builder'}),/Fresh worker invocation required/);
  assert.equal(q.claim('B',{worker:'attempt-2',provider:'builder'}).attempts,2);
}));
