import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-recovery-journal-clock-'));
  let clock=1000, sequence=null, calls=0;
  const now=()=>{calls++;return sequence?.length ? sequence.shift() : clock;};
  try {
    const file=join(dir,'queue.jsonl');
    const q=new DurableQueue(file,{now,leaseMs:100});
    for (const id of ['A','B']) {
      q.create({id,repo:'Zoodo',description:'clock fence'});
      q.claim(id,{worker:`worker-${id}`,provider:`provider-${id}`});
    }
    return fn({q,file,setSequence:x=>{sequence=[...x];calls=0;},calls:()=>calls});
  } finally {rmSync(dir,{recursive:true,force:true});}
}

test('recovery persists all expired tickets using the validated single clock snapshot',()=>fixture(({q,file,setSequence,calls})=>{
  setSequence([1100,NaN,Infinity]);
  const recovered=q.recover();
  assert.equal(recovered.length,2);
  assert.equal(calls(),1,'journal timestamps must not read a new clock');
  assert.equal(q.get('A').status,'queued');
  assert.equal(q.get('B').status,'queued');
  const events=readFileSync(file,'utf8').trim().split('\n').map(JSON.parse).filter(e=>e.type==='requeue');
  assert.equal(events.length,2);
  assert.deepEqual(events.map(e=>e.at),['1970-01-01T00:00:01.100Z','1970-01-01T00:00:01.100Z']);
}));

test('recovery journal is deterministic when the clock advances after the lease decision',()=>fixture(({q,file,setSequence})=>{
  setSequence([1100,9000,9001]);
  assert.equal(q.recover().length,2);
  const events=readFileSync(file,'utf8').trim().split('\n').map(JSON.parse).filter(e=>e.type==='requeue');
  assert.deepEqual(events.map(e=>e.at),['1970-01-01T00:00:01.100Z','1970-01-01T00:00:01.100Z']);
}));
