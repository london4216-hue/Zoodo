import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DurableQueue } from '../src/durable-queue.mjs';

const withJournal = fn => {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-replay-record-'));
  try { return fn(join(dir, 'queue.jsonl')); }
  finally { rmSync(dir, { recursive: true, force: true }); }
};
const create = JSON.stringify({ eventId:'create-1', type:'create', id:'Z-1', repo:'Zoodo', description:'Replay record fence', releaseRequired:false });

test('replay rejects an unterminated JSONL record', () => withJournal(file => {
  writeFileSync(file, create);
  assert.throws(() => new DurableQueue(file), /Incomplete journal record/);
  assert.equal(readFileSync(file, 'utf8'), create);
}));

test('replay rejects blank interior records rather than silently skipping them', () => withJournal(file => {
  const raw = create + '\n\n';
  writeFileSync(file, raw);
  assert.throws(() => new DurableQueue(file), /Empty journal record/);
  assert.equal(readFileSync(file, 'utf8'), raw);
}));

test('replay preserves a valid newline-terminated journal and subsequent append', () => withJournal(file => {
  writeFileSync(file, create + '\n');
  const queue = new DurableQueue(file, { now: () => 1000 });
  assert.equal(queue.get('Z-1').status, 'queued');
  queue.claim('Z-1', { worker:'worker-1', provider:'provider-1' });
  const restored = new DurableQueue(file);
  assert.equal(restored.get('Z-1').status, 'assigned');
  assert.equal(restored.events.length, 2);
}));
