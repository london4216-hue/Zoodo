import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-clock-journal-'));
  const file = join(dir, 'queue.jsonl');
  try {
    const q = new DurableQueue(file, {now: () => 100000, leaseMs: 1000});
    q.create({id: 'A', repo: 'Zoodo', description: 'Clock consistency'});
    run(q, file);
  } finally { rmSync(dir, {recursive: true, force: true}); }
}
const lastEvent = file => JSON.parse(readFileSync(file, 'utf8').trim().split('\n').at(-1));

test('claim journal timestamp uses same validated clock as lease deadline', () => fixture((q, file) => {
  let reads = 0;
  q.now = () => ++reads === 1 ? 100000 : 200000;
  q.claim('A', {worker: 'worker-1', provider: 'provider-1'});
  assert.equal(lastEvent(file).at, new Date(100000).toISOString());
  assert.equal(lastEvent(file).leaseUntil, 101000);
  assert.equal(reads, 1, 'claim must sample clock only once');
}));

test('claim cannot be interrupted by invalid second clock read after valid lease', () => fixture((q, file) => {
  let reads = 0;
  q.now = () => ++reads === 1 ? 100000 : NaN;
  q.claim('A', {worker: 'worker-1', provider: 'provider-1'});
  assert.equal(lastEvent(file).at, new Date(100000).toISOString());
  assert.equal(reads, 1);
}));

test('heartbeat journal timestamp uses same validated clock as lease renewal', () => fixture((q, file) => {
  q.claim('A', {worker: 'worker-1', provider: 'provider-1'});
  let reads = 0;
  q.now = () => ++reads === 1 ? 100500 : 200000;
  q.heartbeat('A', 'worker-1');
  assert.equal(lastEvent(file).at, new Date(100500).toISOString());
  assert.equal(lastEvent(file).leaseUntil, 101500);
  assert.equal(reads, 1, 'heartbeat must sample clock only once');
}));

test('heartbeat survives invalid second clock read without partial journal mutation', () => fixture((q, file) => {
  q.claim('A', {worker: 'worker-1', provider: 'provider-1'});
  let reads = 0;
  q.now = () => ++reads === 1 ? 100500 : NaN;
  q.heartbeat('A', 'worker-1');
  assert.equal(lastEvent(file).at, new Date(100500).toISOString());
  assert.equal(reads, 1);
}));
