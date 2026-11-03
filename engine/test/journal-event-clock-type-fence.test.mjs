import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA='a'.repeat(40);
function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-journal-clock-'));
  const file=join(dir,'queue.jsonl');
  let clock=100000;
  const now=()=>clock;
  try {fn({file,now,setClock:value=>{clock=value}})}
  finally {rmSync(dir,{recursive:true,force:true})}
}

test('non-numeric create clock cannot write a misleading journal timestamp',()=>fixture(({file,now,setClock})=>{
  const q=new DurableQueue(file,{now});
  setClock('0');
  assert.throws(()=>q.create({id:'A',repo:'Zoodo',description:'Clock fence'}),/Invalid journal clock/);
  assert.equal(existsSync(file),false);
  assert.equal(q.get('A'),null);
  setClock(100000);
  assert.equal(q.create({id:'A',repo:'Zoodo',description:'Clock fence'}).status,'queued');
}));

test('review approval cannot journal an unvalidated clock after valid lease',()=>fixture(({file,now,setClock})=>{
  const q=new DurableQueue(file,{now});
  q.create({id:'B',repo:'Zoodo',description:'Clock fence'});
  q.claim('B',{worker:'builder',provider:'build'});
  q.start('B','builder');
  q.submit('B','builder',{commit:SHA,evidence:'https://example.test/submit'});
  const before=readFileSync(file,'utf8');
  setClock('0');
  assert.throws(()=>q.approve('B',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:'https://example.test/review',approved:true}),/Invalid journal clock/);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('B').status,'review');
  setClock(100000);
  assert.equal(q.approve('B',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:'https://example.test/review',approved:true}).status,'test');
}));

test('done cannot persist an unsafe clock and remains retryable',()=>fixture(({file,now,setClock})=>{
  const q=new DurableQueue(file,{now});
  q.create({id:'C',repo:'Zoodo',description:'Clock fence'});
  q.claim('C',{worker:'builder',provider:'build'});
  q.start('C','builder');
  q.submit('C','builder',{commit:SHA,evidence:'https://example.test/submit'});
  q.approve('C',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:'review',approved:true});
  q.tested('C',{passed:true,evidence:'local test'});
  q.verify('C',{evidence:'verified'});
  const before=readFileSync(file,'utf8');
  setClock('0');
  assert.throws(()=>q.done('C'),/Invalid journal clock/);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('C').status,'verified');
  setClock(100000);
  assert.equal(q.done('C').status,'done');
}));
