import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

// Align pilot journal ticket keys with 001_ticket_directory.sql, without
// changing worker/provider/reviewer identity semantics or existing journals.
function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-sql-ticket-key-'));
  try {fn(join(dir,'queue.jsonl'))}
  finally {rmSync(dir,{recursive:true,force:true})}
}

test('ticket keys rejected by private SQL queue cannot enter pilot journal',()=>fixture(file=>{
  const q=new DurableQueue(file,{now:()=>100000});
  const invalid=['T\n1','T\r1','T 1','T#1','T'+'x'.repeat(120)];
  for(const id of invalid) {
    assert.throws(()=>q.create({id,repo:'Zoodo',description:'One ticket'}),/Ticket needs id/);
  }
  assert.equal(q.events.length,0);
  assert.equal(q.list().length,0);
  assert.equal(new DurableQueue(file).list().length,0);
}));

test('SQL-compatible ticket keys remain valid, replayable and idempotent',()=>fixture(file=>{
  const q=new DurableQueue(file,{now:()=>100000});
  for(const id of ['T1','T-2','A_b.c:3']) {
    q.create({id,repo:'Zoodo',description:'One ticket'});
    q.create({id,repo:'Zoodo',description:'One ticket'});
  }
  assert.deepEqual(q.list().map(t=>t.id),['T1','T-2','A_b.c:3']);
  assert.equal(q.events.length,3);
  assert.deepEqual(new DurableQueue(file).list().map(t=>t.id),['T1','T-2','A_b.c:3']);
}));
