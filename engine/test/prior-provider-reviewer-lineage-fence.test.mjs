import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA='a'.repeat(40);
function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-provider-lineage-'));
  const file=join(dir,'queue.jsonl');
  const make=()=>new DurableQueue(file,{now:()=>100000,leaseMs:100,maxAttempts:3});
  try {fn(make)} finally {rmSync(dir,{recursive:true,force:true})}
}
function replacementReady(q) {
  q.create({id:'T1',repo:'Zoodo',description:'Replacement review independence'});
  q.claim('T1',{worker:'builder-attempt-1',provider:'model-A'});
  q.fail('T1',{worker:'builder-attempt-1',reason:'worker failed'});
  q.claim('T1',{worker:'builder-attempt-2',provider:'model-B'});
  q.start('T1','builder-attempt-2');
  q.submit('T1','builder-attempt-2',{commit:SHA,evidence:'https://github.com/example/pr/1'});
}
test('historical builder provider cannot approve replacement commit',()=>fixture(make=>{
  const q=make();replacementReady(q);
  assert.throws(()=>q.approve('T1',{reviewer:'reviewer-from-A',provider:'model-A',commit:SHA,evidence:'review',approved:true}),/Independent exact-commit review required/);
  assert.equal(q.get('T1').status,'review');
}));
test('historical builder provider remains excluded after journal restart',()=>fixture(make=>{
  let q=make();replacementReady(q);q=make();
  assert.throws(()=>q.approve('T1',{reviewer:'new-reviewer-from-A',provider:'model-A',commit:SHA,evidence:'review',approved:true}),/Independent exact-commit review required/);
  assert.equal(q.get('T1').status,'review');
}));
test('genuinely independent third provider can approve replacement commit',()=>fixture(make=>{
  let q=make();replacementReady(q);q=make();
  assert.equal(q.approve('T1',{reviewer:'reviewer-from-C',provider:'model-C',commit:SHA,evidence:'review',approved:true}).status,'test');
  assert.equal(make().get('T1').reviewProvider,'model-C');
}));
