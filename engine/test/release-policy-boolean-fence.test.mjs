import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function withQueue(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-release-policy-'));
  const file = join(dir, 'journal.jsonl');
  try { fn(new DurableQueue(file, {now: () => 1000}), file); }
  finally { rmSync(dir, {recursive:true, force:true}); }
}

for (const value of ['false', 'true', null, 0, 1, {}, []]) {
  test('rejects nonboolean releaseRequired without journal mutation: '+JSON.stringify(value), () => withQueue((q,file) => {
    assert.throws(
      () => q.create({id:'T1', repo:'Zoodo', description:'Release policy integrity', releaseRequired:value}),
      /Release requirement must be boolean/
    );
    assert.equal(existsSync(file), false, 'invalid policy must not create journal');
    assert.equal(q.get('T1'), null);
  }));
}

test('valid false remains idempotent and true remains release-gated', () => withQueue((q,file) => {
  const base={id:'T1',repo:'Zoodo',description:'Release policy integrity'};
  assert.equal(q.create({...base,releaseRequired:false}).releaseRequired,false);
  const before=readFileSync(file,'utf8');
  assert.equal(q.create({...base,releaseRequired:false}).releaseRequired,false);
  assert.equal(readFileSync(file,'utf8'),before,'idempotent create must not append');
  assert.equal(q.create({...base,id:'T2',releaseRequired:true}).releaseRequired,true);
  assert.throws(()=>q.create({...base,releaseRequired:true}),/Idempotency collision/);
}));
