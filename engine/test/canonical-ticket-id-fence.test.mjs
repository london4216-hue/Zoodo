import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-ticket-id-'));
  const file=join(dir,'queue.jsonl');
  try {fn(file)} finally {rmSync(dir,{recursive:true,force:true})}
}

test('noncanonical ticket ID aliases cannot create duplicate durable work',()=>fixture(file=>{
  const q=new DurableQueue(file,{now:()=>100000});
  q.create({id:'ZOO-7',repo:'Zoodo',description:'One integration task'});
  for(const id of [' ZOO-7 ','ZOO-7\n']){
    assert.throws(()=>q.create({id,repo:'Zoodo',description:'One integration task'}),/Ticket needs id/);
  }
  assert.equal(q.list().length,1);
  assert.deepEqual(q.list().map(t=>t.id),['ZOO-7']);
  assert.equal(new DurableQueue(file).list().length,1);
}));

test('invalid initial ticket ID does not append journal events',()=>fixture(file=>{
  const q=new DurableQueue(file,{now:()=>100000});
  assert.throws(()=>q.create({id:' ZOO-8 ',repo:'Zoodo',description:'Another task'}),/Ticket needs id/);
  assert.equal(q.events.length,0);
  assert.equal(q.list().length,0);
  assert.equal(new DurableQueue(file).list().length,0);
}));
