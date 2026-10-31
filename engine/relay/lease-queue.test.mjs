import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LeaseQueue } from './lease-queue.mjs';
function run(fn){const dir=mkdtempSync(join(tmpdir(),'zoo-'));let now=10000;const path=join(dir,'q.db');const a=new LeaseQueue(path,()=>now);try{fn(a,()=>new LeaseQueue(path,()=>now),ms=>now+=ms);}finally{a.close();rmSync(dir,{recursive:true,force:true});}}
test('two-ticket chain, crash recovery and fenced stale receipt',()=>run((q,other,tick)=>{
  assert.equal(q.add({id:'A',source:'https://github.com/london4216-hue/Zoodo/issues/18'}),true);
  assert.equal(q.add({id:'A',source:'same'}),false);
  q.add({id:'B',source:'https://github.com/london4216-hue/Zoodo/issues/17',deps:['A']});
  const a=q.claim('worker-1',1000);assert.equal(a.id,'A');assert.equal(q.claim('worker-2'),null);
  tick(1001);const b=q.claim('worker-2');assert.equal(b.id,'A');assert.notEqual(b.token,a.token);
  assert.equal(q.settle('A',a.token,{sha:'stale',test:'fake'}),false);
  assert.equal(q.settle('A',b.token,{sha:'abc123',test:'local:pass'}),true);
  const c=q.claim('worker-3');assert.equal(c.id,'B');assert.equal(q.settle('B',c.token,{sha:'def456',test:'local:pass'}),true);
  assert.deepEqual(q.jobs().map(j=>j.status),['DONE','DONE']);
  assert.equal(q.receipts().filter(r=>r.event==='EXPIRED').length,1);
}));
test('atomic claim across two SQLite connections',()=>run((q,other)=>{
  q.add({id:'A',source:'issue'});const b=other();try{assert.equal(q.claim('one').id,'A');assert.equal(b.claim('two'),null);}finally{b.close();}
}));
test('bounded worker replacement ends in BLOCKED, never invented DONE',()=>run(q=>{
  q.add({id:'A',source:'issue',max_attempts:2});let a=q.claim('one');q.settle('A',a.token,{reason:'failure'});
  a=q.claim('two');q.settle('A',a.token,{reason:'failure'});
  assert.equal(q.jobs()[0].status,'BLOCKED');assert.equal(q.claim('three'),null);
}));
test('cannot complete without test evidence',()=>run(q=>{
  q.add({id:'A',source:'issue'});const a=q.claim('one');assert.throws(()=>q.settle('A',a.token,{sha:'abc'}),/test receipt/);
  assert.equal(q.jobs()[0].status,'CLAIMED');
}));
