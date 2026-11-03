import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(started=true) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-clock-type-'));
  let current=1000;
  const queue=new DurableQueue(join(dir,'queue.jsonl'),{now:()=>current,leaseMs:50});
  queue.create({id:'T1',repo:'example/repo',description:'clock type regression'});
  queue.claim('T1',{worker:'invocation-1',provider:'provider-a'});
  if(started) queue.start('T1','invocation-1');
  return {queue,setClock:value=>{current=value},cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}

test('expired running worker cannot submit with string clock that coerces to zero',()=>{
  const f=fixture();
  try {
    f.setClock('0'); // invalid clock type; Date('0') is valid, numeric comparison coerces to 0
    assert.throws(()=>f.queue.submit('T1','invocation-1',{commit:'a'.repeat(40),evidence:'synthetic commit'}),/active lease|clock|deadline/i);
    assert.equal(f.queue.get('T1').status,'running');
  } finally {f.cleanup()}
});

test('expired assigned worker cannot start with string clock that coerces to zero',()=>{
  const f=fixture(false);
  try {
    f.setClock('0');
    assert.throws(()=>f.queue.start('T1','invocation-1'),/active lease|clock|deadline/i);
    assert.equal(f.queue.get('T1').status,'assigned');
  } finally {f.cleanup()}
});

test('invalid clock cannot prevent expired-lease recovery silently',()=>{
  const f=fixture();
  try {
    f.setClock('0');
    assert.throws(()=>f.queue.recover(),/clock|deadline|time/i);
    assert.equal(f.queue.get('T1').status,'running');
  } finally {f.cleanup()}
});

test('numeric clock still recovers expired lease and refuses late submit',()=>{
  const f=fixture();
  try {
    f.setClock(1100);
    assert.equal(f.queue.recover().length,1);
    assert.equal(f.queue.get('T1').status,'queued');
    assert.throws(()=>f.queue.submit('T1','invocation-1',{commit:'a'.repeat(40),evidence:'late'}),/active lease/i);
  } finally {f.cleanup()}
});
