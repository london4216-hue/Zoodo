import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-deadline-overflow-'));
  const file = join(dir, 'queue.jsonl');
  let clock = 1000;
  const q = new DurableQueue(file, {now: () => clock, leaseMs: Number.MAX_SAFE_INTEGER - 1000});
  q.create({id: 'A', repo: 'Zoodo', description: 'Lease arithmetic bounds'});
  try { run({q, file, setClock: value => { clock = value; }}); }
  finally { rmSync(dir, {recursive: true, force: true}); }
}

test('overflowing claim deadline leaves the ticket queued and journal unchanged', () => fixture(({q, file, setClock}) => {
  setClock(1001);
  const before = readFileSync(file, 'utf8');
  assert.throws(() => q.claim('A', {worker: 'worker-1', provider: 'one'}), /deadline/i);
  assert.equal(q.get('A').status, 'queued');
  assert.equal(q.get('A').attempts, 0);
  assert.equal(readFileSync(file, 'utf8'), before);
}));

test('overflowing heartbeat cannot corrupt a previously valid persisted lease', () => fixture(({q, file, setClock}) => {
  q.claim('A', {worker: 'worker-1', provider: 'one'});
  assert.equal(q.get('A').leaseUntil, Number.MAX_SAFE_INTEGER);
  const before = readFileSync(file, 'utf8');
  setClock(1001);
  assert.throws(() => q.heartbeat('A', 'worker-1'), /deadline/i);
  assert.equal(q.get('A').leaseUntil, Number.MAX_SAFE_INTEGER);
  assert.equal(readFileSync(file, 'utf8'), before);
  const restarted = new DurableQueue(file, {now: () => 1001});
  assert.deepEqual(restarted.recover(), []);
  assert.equal(restarted.start('A', 'worker-1').status, 'running');
}));
