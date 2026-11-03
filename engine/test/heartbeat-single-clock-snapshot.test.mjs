import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(run) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-heartbeat-clock-snapshot-'));
  try {
    let time=100000;
    let q=new DurableQueue(join(dir,'q.jsonl'),{now:()=>time,leaseMs:1000});
    q.create({id:'CLOCK-1',repo:'Zoodo',description:'Clock snapshot heartbeat'});
    q.claim('CLOCK-1',{worker:'native-worker-1',provider:'native-provider'});
    assert.equal(q.get('CLOCK-1').leaseUntil,101000);
    run(q, t=>{time=t},join(dir,'q.jsonl'));
  } finally {rmSync(dir,{recursive:true,force:true})}
}

test('clock rollback between validation and renewal does not silently discard heartbeat',()=>fixture((q,setTime,file)=>{
  let reads=0;
  q.now=()=>++reads===1 ? 100500 : 99000;
  assert.equal(q.heartbeat('CLOCK-1','native-worker-1').leaseUntil,101500,
    'heartbeat renewal must use the same validated clock instant as active-lease check');
  const replay=new DurableQueue(file,{now:()=>101001,leaseMs:1000});
  assert.equal(replay.recover().length,0,'valid heartbeat must prevent premature NEXT');
}));

test('clock jumps past expiry between validation and renewal cannot lengthen lease using later time',()=>fixture((q,setTime,file)=>{
  let reads=0;
  q.now=()=>++reads===1 ? 100500 : 101001;
  assert.equal(q.heartbeat('CLOCK-1','native-worker-1').leaseUntil,101500,
    'later clock jump must not be used for a deadline that bypasses validation');
  const replay=new DurableQueue(file,{now:()=>101500,leaseMs:1000});
  assert.equal(replay.recover().length,1,'lease must expire at the one-snapshot deadline');
}));

test('normal heartbeat still extends lease and survives replay',()=>fixture((q,setTime,file)=>{
  setTime(100500);
  assert.equal(q.heartbeat('CLOCK-1','native-worker-1').leaseUntil,101500);
  const replay=new DurableQueue(file,{now:()=>101499,leaseMs:1000});
  assert.equal(replay.recover().length,0);
  const expired=new DurableQueue(file,{now:()=>101500,leaseMs:1000});
  assert.equal(expired.recover().length,1);
}));

test('expired heartbeat is still rejected',()=>fixture((q,setTime)=>{
  setTime(101000);
  assert.throws(()=>q.heartbeat('CLOCK-1','native-worker-1'),/No active lease/);
  assert.equal(q.get('CLOCK-1').leaseUntil,101000);
}));
