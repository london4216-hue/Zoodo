import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(id) {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-lease-clock-'));
  let samples = [];
  let reads = 0;
  const now = () => { reads++; return samples.length ? samples.shift() : 1000; };
  const queue = new DurableQueue(join(dir, 'journal.jsonl'), {now, leaseMs:1000});
  queue.create({id, repo:'Zoodo', description:'clock snapshot regression'});
  queue.claim(id, {worker:'worker-1', provider:'test-provider'});
  return {
    queue,
    clock: (...values) => { samples = values; },
    reads: () => reads,
    cleanup: () => rmSync(dir, {recursive:true, force:true})
  };
}

test('start journals the same validated clock used for lease eligibility', t => {
  const f = fixture('start-ticket'); t.after(f.cleanup);
  f.clock(1001, 5000);
  const before = f.reads();
  const result = f.queue.start('start-ticket', 'worker-1');
  assert.equal(result.status, 'running');
  assert.equal(Date.parse(result.history.at(-1).at), 1001);
  assert.equal(f.reads() - before, 1);
});

test('submit cannot journal a second, expired clock reading', t => {
  const f = fixture('submit-ticket'); t.after(f.cleanup);
  f.queue.start('submit-ticket', 'worker-1');
  f.clock(1002, 6000);
  const before = f.reads();
  const result = f.queue.submit('submit-ticket', 'worker-1', {
    commit:'a'.repeat(40), evidence:'local exact-SHA test'
  });
  assert.equal(result.status, 'review');
  assert.equal(Date.parse(result.history.at(-1).at), 1002);
  assert.equal(f.reads() - before, 1);
});

test('worker failure journals the same clock used for active-lease validation', t => {
  const f = fixture('failure-ticket'); t.after(f.cleanup);
  f.clock(1003, 7000);
  const before = f.reads();
  const result = f.queue.fail('failure-ticket', {worker:'worker-1', reason:'synthetic failure'});
  assert.equal(result.status, 'queued');
  assert.equal(Date.parse(result.history.at(-1).at), 1003);
  assert.equal(f.reads() - before, 1);
});
