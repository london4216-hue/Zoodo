import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendJournalEvent } from '../src/atomic-journal.mjs';

function withJournal(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-os1-journal-interior-'));
  try { return fn(join(dir, 'queue.jsonl')); }
  finally { rmSync(dir, {recursive:true, force:true}); }
}

for (const [name,corrupt] of [
  ['invalid JSON', '{invalid'],
  ['empty line', ''],
  ['JSON scalar', '42'],
  ['missing eventId', '{"type":"claim"}']
]) {
  test('rejects '+name+' in interior record before appending', () => withJournal(file => {
    const before = '{"eventId":"one"}\n' + corrupt + '\n{"eventId":"three"}\n';
    writeFileSync(file, before);
    assert.throws(() => appendJournalEvent(file,{eventId:'four'},3,'three'), /Invalid journal record/);
    assert.equal(readFileSync(file,'utf8'), before);
  }));
}
test('preserves valid multi-record append and tail checkpoint', () => withJournal(file => {
  appendJournalEvent(file,{eventId:'one'},0);
  appendJournalEvent(file,{eventId:'two'},1,'one');
  appendJournalEvent(file,{eventId:'three'},2,'two');
  assert.equal(readFileSync(file,'utf8').trim().split('\n').length,3);
}));
