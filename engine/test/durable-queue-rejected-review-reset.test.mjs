import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DurableQueue } from '../src/durable-queue.mjs';

test('rejected review clears stale commit while retaining durable rejection evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-review-requeue-'));
  const file = join(dir, 'queue.jsonl');
  const make = () => new DurableQueue(file, { now: () => 100000 });
  const commit = 'a'.repeat(40);
  try {
    const q = make();
    q.create({ id: 'R-1', repo: 'Zoodo', description: 'Rejected review reset' });
    q.claim('R-1', { worker: 'invocation-1', provider: 'provider-1' });
    q.start('R-1', 'invocation-1');
    q.submit('R-1', 'invocation-1', { commit, evidence: 'test-source-receipt' });
    q.approve('R-1', { reviewer: 'reviewer-2', provider: 'provider-2', commit, evidence: 'rejected-commit', approved: false });
    for (const state of [q.get('R-1'), make().get('R-1')]) {
      assert.equal(state.status, 'queued');
      assert.equal(state.commit, null);
      assert.equal(state.releaseProof, null);
      assert.equal(state.worker, null);
      assert.ok(state.history.some(e => e.type === 'requeue' && e.evidence === 'rejected-commit'));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('accepted review still retains the exact submitted commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-review-accept-'));
  const file = join(dir, 'queue.jsonl');
  const commit = 'b'.repeat(40);
  try {
    const q = new DurableQueue(file, { now: () => 100000 });
    q.create({ id: 'R-2', repo: 'Zoodo', description: 'Accepted review retains commit' });
    q.claim('R-2', { worker: 'invocation-3', provider: 'provider-3' });
    q.start('R-2', 'invocation-3');
    q.submit('R-2', 'invocation-3', { commit, evidence: 'test-source-receipt' });
    q.approve('R-2', { reviewer: 'reviewer-4', provider: 'provider-4', commit, evidence: 'accepted-commit', approved: true });
    assert.equal(q.get('R-2').status, 'test');
    assert.equal(q.get('R-2').commit, commit);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
