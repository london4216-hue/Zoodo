import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

test('backwards wall-clock heartbeat never shortens a valid worker lease',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zoo-heartbeat-clock-'));
  try {
    let now=100000;
    const file=join(dir,'queue.jsonl');
    const make=()=>new DurableQueue(file,{now:()=>now,leaseMs:1000});
    let q=make();
    q.create({id:'ZOO-96',repo:'Zoodo',description:'Lease clock rollback'});
    q.claim('ZOO-96',{worker:'native-worker-1',provider:'native-provider'});
    assert.equal(q.get('ZOO-96').leaseUntil,101000);
    now=99000;
    q.heartbeat('ZOO-96','native-worker-1');
    assert.equal(q.get('ZOO-96').leaseUntil,101000,'rollback must not shorten original lease');
    now=100001;
    assert.deepEqual(q.recover(),[],'recovery must not dispatch replacement before original expiry');
    q=make();
    assert.equal(q.get('ZOO-96').leaseUntil,101000,'journal replay preserves lease fence');
    now=101000;
    assert.equal(q.recover().length,1,'recovery remains eligible at original expiry');
  } finally {rmSync(dir,{recursive:true,force:true})}
});

test('normal heartbeat extends lease, persists through restart, and permits bounded recovery',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zoo-heartbeat-normal-'));
  try {
    let now=100000;
    const file=join(dir,'queue.jsonl');
    const make=()=>new DurableQueue(file,{now:()=>now,leaseMs:1000});
    let q=make();
    q.create({id:'ZOO-97',repo:'Zoodo',description:'Normal heartbeat'});
    q.claim('ZOO-97',{worker:'native-worker-1',provider:'native-provider'});
    now=100500;
    q.heartbeat('ZOO-97','native-worker-1');
    assert.equal(q.get('ZOO-97').leaseUntil,101500);
    q=make();
    now=101000;
    assert.deepEqual(q.recover(),[]);
    now=101500;
    assert.equal(q.recover().length,1);
    assert.equal(q.claim('ZOO-97',{worker:'native-worker-2',provider:'native-provider'}).status,'assigned');
    assert.equal(make().get('ZOO-97').worker,'native-worker-2');
  } finally {rmSync(dir,{recursive:true,force:true})}
});

test('expired worker heartbeat cannot resurrect its lease',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zoo-heartbeat-expired-'));
  try {
    let now=100000;
    const q=new DurableQueue(join(dir,'queue.jsonl'),{now:()=>now,leaseMs:1000});
    q.create({id:'ZOO-98',repo:'Zoodo',description:'Expired heartbeat'});
    q.claim('ZOO-98',{worker:'native-worker-1',provider:'native-provider'});
    now=101000;
    assert.throws(()=>q.heartbeat('ZOO-98','native-worker-1'),/No active lease/);
    assert.equal(q.get('ZOO-98').leaseUntil,101000);
  } finally {rmSync(dir,{recursive:true,force:true})}
});
