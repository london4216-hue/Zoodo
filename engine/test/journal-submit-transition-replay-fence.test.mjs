import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA = 'a'.repeat(40);
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-submit-transition-'));
  const file = join(dir, 'journal.jsonl');
  const make = () => new DurableQueue(file, {now: () => 100000, leaseMs: 100});
  const inject = (fields = {}) => appendFileSync(file, JSON.stringify({
    eventId: randomUUID(), type: 'submit', id: 'T',
    at: new Date(100000).toISOString(), commit: SHA, evidence: 'forged PR', ...fields
  }) + '\n');
  try { return fn({file, make, inject}); }
  finally { rmSync(dir, {recursive: true, force: true}); }
}
function rejectUnchanged(file, make) {
  const before = readFileSync(file, 'utf8');
  assert.throws(make, /Invalid journal submission transition/);
  assert.equal(readFileSync(file, 'utf8'), before, 'preserve original journal evidence');
}

test('forged submission cannot move queued ticket to review', () => fixture(({file, make, inject}) => {
  make().create({id: 'T', repo: 'Zoodo', description: 'Replay'});
  inject();
  rejectUnchanged(file, make);
}));
test('forged submission cannot bypass start on assigned ticket', () => fixture(({file, make, inject}) => {
  const q = make();
  q.create({id: 'T', repo: 'Zoodo', description: 'Replay'});
  q.claim('T', {worker: 'worker1', provider: 'builder'});
  inject();
  rejectUnchanged(file, make);
}));
test('forged duplicate submission cannot replace review commit', () => fixture(({file, make, inject}) => {
  const q = make();
  q.create({id: 'T', repo: 'Zoodo', description: 'Replay'});
  q.claim('T', {worker: 'worker1', provider: 'builder'});
  q.start('T', 'worker1');
  q.submit('T', 'worker1', {commit: SHA, evidence: 'original PR'});
  inject({commit: 'b'.repeat(40)});
  rejectUnchanged(file, make);
}));
test('forged submission cannot resurrect blocked ticket', () => fixture(({file, make, inject}) => {
  const q = make();
  q.create({id: 'T', repo: 'Zoodo', description: 'Replay'});
  q.claim('T', {worker: 'worker1', provider: 'builder'});
  q.start('T', 'worker1');
  q.fail('T', {worker: 'worker1', reason: 'failure'});
  inject();
  rejectUnchanged(file, make);
}));
test('valid running submission remains replayable after restart', () => fixture(({make}) => {
  const q = make();
  q.create({id: 'T', repo: 'Zoodo', description: 'Replay'});
  q.claim('T', {worker: 'worker1', provider: 'builder'});
  q.start('T', 'worker1');
  q.submit('T', 'worker1', {commit: SHA, evidence: 'real PR'});
  const restored = make().get('T');
  assert.equal(restored.status, 'review');
  assert.equal(restored.commit, SHA);
}));
