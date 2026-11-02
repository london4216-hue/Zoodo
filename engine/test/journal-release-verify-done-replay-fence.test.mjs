import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA = 'a'.repeat(40);
function fixture(fn, releaseRequired = false) {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-journal-replay-'));
  const file = join(dir, 'queue.jsonl');
  const make = () => new DurableQueue(file, {now: () => 100000, leaseMs: 100});
  try {
    const q = make();
    q.create({id: 'T', repo: 'Zoodo', description: 'Replay authorization test', releaseRequired});
    return fn({q, make, file});
  } finally { rmSync(dir, {recursive: true, force: true}); }
}
function inject(file, type, fields = {}) {
  appendFileSync(file, JSON.stringify({
    eventId: 'injected-' + type, type, id: 'T',
    at: new Date(100000).toISOString(), ...fields
  }) + '\n');
}
function toPassedTests(q) {
  q.claim('T', {worker: 'worker1', provider: 'builder'});
  q.start('T', 'worker1');
  q.submit('T', 'worker1', {commit: SHA, evidence: 'PR receipt'});
  q.approve('T', {reviewer: 'reviewer2', provider: 'reviewer', commit: SHA, evidence: 'review receipt', approved: true});
  q.tested('T', {passed: true, evidence: 'test receipt'});
}

test('replay rejects release on queued ticket', () => fixture(({file, make}) => {
  inject(file, 'release', {evidence: 'forged'});
  assert.throws(make, /Invalid journal release evidence/);
}, true));

test('replay rejects verify on queued ticket', () => fixture(({file, make}) => {
  inject(file, 'verify', {evidence: 'forged'});
  assert.throws(make, /Invalid journal verification evidence/);
}));

test('replay rejects done on queued ticket', () => fixture(({file, make}) => {
  inject(file, 'done');
  assert.throws(make, /Invalid journal completion state/);
}));

test('replay rejects release when release is not required', () => fixture(({file, make}) => {
  inject(file, 'release', {evidence: 'forged'});
  assert.throws(make, /Invalid journal release evidence/);
}));

test('replay rejects verify without required release proof', () => fixture(({q, file, make}) => {
  toPassedTests(q);
  inject(file, 'verify', {evidence: 'forged'});
  assert.throws(make, /Invalid journal verification evidence/);
}, true));

test('replay rejects done before verification', () => fixture(({q, file, make}) => {
  toPassedTests(q);
  inject(file, 'done');
  assert.throws(make, /Invalid journal completion state/);
}));

test('legitimate release, verification, completion survive journal restart', () => fixture(({q, make}) => {
  toPassedTests(q);
  q.release('T', {authorized: true, evidence: 'owner release receipt'});
  q.verify('T', {evidence: 'exact SHA verification receipt'});
  q.done('T');
  assert.equal(make().get('T').status, 'done');
}, true));
