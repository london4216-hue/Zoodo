import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA = 'a'.repeat(40);
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-sha-type-fence-'));
  const file = join(dir, 'queue.jsonl');
  try {
    const q = new DurableQueue(file, {now: () => 100000});
    q.create({id: 'T1', repo: 'Zoodo', description: 'SHA type fence'});
    q.claim('T1', {worker: 'invocation-1', provider: 'builder'});
    q.start('T1', 'invocation-1');
    fn(q, file);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

test('boxed String SHA must not enter durable journal or strand exact-commit review', () => fixture((q, file) => {
  const before = readFileSync(file, 'utf8');
  assert.throws(() => q.submit('T1', 'invocation-1', {
    commit: new String(SHA), evidence: 'https://example.test/submission'
  }), /Exact commit SHA and evidence required/);
  assert.equal(readFileSync(file, 'utf8'), before);
  assert.equal(q.get('T1').status, 'running');
  q.submit('T1', 'invocation-1', {commit: SHA, evidence: 'https://example.test/submission'});
  assert.equal(q.get('T1').commit, SHA);
  assert.equal(q.approve('T1', {
    reviewer: 'independent', provider: 'reviewer',
    commit: SHA, evidence: 'https://example.test/review', approved: true
  }).status, 'test');
}));

test('custom stringifiable SHA object must be rejected before append', () => fixture((q, file) => {
  const before = readFileSync(file, 'utf8');
  assert.throws(() => q.submit('T1', 'invocation-1', {
    commit: {toString: () => SHA}, evidence: 'https://example.test/submission'
  }), /Exact commit SHA and evidence required/);
  assert.equal(readFileSync(file, 'utf8'), before);
  assert.equal(q.get('T1').status, 'running');
}));
