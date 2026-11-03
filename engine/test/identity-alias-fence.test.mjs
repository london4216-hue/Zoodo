import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-identity-alias-'));
  const file=join(dir,'queue.jsonl');
  try { fn(new DurableQueue(file,{now:()=>100000,leaseMs:100,maxAttempts:3}),file); }
  finally { rmSync(dir,{recursive:true,force:true}); }
}
const SHA='a'.repeat(40);
const create=(q,id)=>q.create({id,repo:'Zoodo',description:'Identity alias fencing'});

test('padded worker identity cannot bypass single-active-worker fence',()=>fixture((q,file)=>{
  create(q,'A');create(q,'B');
  q.claim('A',{worker:'invocation-1',provider:'builder'});
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.claim('B',{worker:' invocation-1 ',provider:'builder'}),/Real worker identity/);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('B').attempts,0);
}));

test('padded worker identity cannot impersonate a fresh retry invocation',()=>fixture((q,file)=>{
  create(q,'A');
  q.claim('A',{worker:'invocation-1',provider:'builder'});
  q.start('A','invocation-1');
  q.fail('A',{worker:'invocation-1',reason:'Synthetic worker failure'});
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.claim('A',{worker:' invocation-1 ',provider:'builder'}),/Real worker identity/);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('A').attempts,1);
}));

test('padded provider identity cannot acquire a lease',()=>fixture((q,file)=>{
  create(q,'A');
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.claim('A',{worker:'invocation-1',provider:' builder '}),/Real worker identity/);
  assert.equal(readFileSync(file,'utf8'),before);
}));

test('padded reviewer or provider identity cannot bypass independent review',()=>fixture((q,file)=>{
  create(q,'A');
  q.claim('A',{worker:'invocation-1',provider:'builder'});
  q.start('A','invocation-1');
  q.submit('A','invocation-1',{commit:SHA,evidence:'https://github.com/example/pull/1'});
  const before=readFileSync(file,'utf8');
  const base={reviewer:'independent',provider:'reviewer-provider',commit:SHA,evidence:'https://github.com/example/review/1',approved:true};
  assert.throws(()=>q.approve('A',{...base,reviewer:' invocation-1 '}),/Independent exact-commit review required/);
  assert.throws(()=>q.approve('A',{...base,provider:' builder '}),/Independent exact-commit review required/);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('A').status,'review');
  assert.equal(q.get('A').commit,SHA);
}));
