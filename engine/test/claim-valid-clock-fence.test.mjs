import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(clock,check) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-claim-clock-'));
  const file=join(dir,'queue.jsonl');
  try {
    const q=new DurableQueue(file,{now:clock,leaseMs:100,maxAttempts:3});
    q.create({id:'CLOCK-CLAIM',repo:'Zoodo',description:'Bounded claim deadline'});
    check(q,file);
  } finally {rmSync(dir,{recursive:true,force:true})}
}
function rejectInvalid(first) {
  let reads=0;
  fixture(()=>reads++===1?first:100000,(q,file)=>{
    const before=readFileSync(file,'utf8');
    assert.throws(()=>q.claim('CLOCK-CLAIM',{worker:'worker-1',provider:'provider-1'}),/Invalid lease deadline/);
    assert.equal(readFileSync(file,'utf8'),before,'invalid lease must not be appended');
    assert.equal(q.get('CLOCK-CLAIM').status,'queued');
    assert.equal(q.get('CLOCK-CLAIM').attempts,0);
  });
}
test('claim rejects nonnumeric clock before recording a null lease',()=>rejectInvalid(NaN));
test('claim rejects string clock before recording concatenated lease',()=>rejectInvalid('100000'));
test('claim rejects clock deadline overflow before journal mutation',()=>rejectInvalid(Number.MAX_SAFE_INTEGER));
test('claim records valid exact lease deadline and survives restart',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zoo-claim-valid-'));
  const file=join(dir,'queue.jsonl');
  try {
    const q=new DurableQueue(file,{now:()=>100000,leaseMs:100});
    q.create({id:'A',repo:'Zoodo',description:'Valid clock'});
    assert.equal(q.claim('A',{worker:'worker-1',provider:'provider-1'}).leaseUntil,100100);
    assert.equal(new DurableQueue(file,{now:()=>100050,leaseMs:100}).get('A').leaseUntil,100100);
  } finally {rmSync(dir,{recursive:true,force:true})}
});
