import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DurableQueue } from '../src/durable-queue.mjs';
test('two stale queue instances cannot both claim a ticket', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-claim-'));
  try {
    const file = join(dir, 'queue.jsonl');
    const seed = new DurableQueue(file);
    seed.create({id:'Z-1', repo:'Zoodo', description:'Two worker race'});
    const first = new DurableQueue(file), second = new DurableQueue(file);
    first.claim('Z-1', {worker:'builder1', provider:'one'});
    assert.throws(() => second.claim('Z-1', {worker:'builder2', provider:'two'}), /Stale queue snapshot/);
    const restored = new DurableQueue(file);
    assert.equal(restored.get('Z-1').worker, 'builder1');
    assert.equal(restored.get('Z-1').attempts, 1);
    assert.equal(readFileSync(file,'utf8').trim().split('\n').length, 2);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
test('a stale second queue cannot create duplicate ticket after another writer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-create-'));
  try {
    const file = join(dir, 'queue.jsonl');
    const first = new DurableQueue(file), second = new DurableQueue(file);
    first.create({id:'Z-2', repo:'Zoodo', description:'First'});
    assert.throws(() => second.create({id:'Z-2', repo:'Zoodo', description:'First'}), /Stale queue snapshot/);
    assert.equal(new DurableQueue(file).list().length, 1);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
