import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendJournalEvent } from '../src/atomic-journal.mjs';
const withFile = fn => { const dir = mkdtempSync(join(tmpdir(), 'zoo-atomic-')); try { return fn(join(dir, 'queue.jsonl')); } finally { rmSync(dir, {recursive:true, force:true}); } };
test('appends events with exact checkpoint', () => withFile(file => {
  appendJournalEvent(file, {eventId:'one', type:'create'}, 0);
  appendJournalEvent(file, {eventId:'two', type:'claim'}, 1, 'one');
  assert.deepEqual(readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse).map(x=>x.eventId), ['one','two']);
}));
test('rejects two stale independent claim snapshots', () => withFile(file => {
  appendJournalEvent(file, {eventId:'create'}, 0);
  appendJournalEvent(file, {eventId:'claim-1'}, 1, 'create');
  assert.throws(() => appendJournalEvent(file, {eventId:'claim-2'}, 1, 'create'), /Stale queue snapshot/);
  assert.equal(readFileSync(file,'utf8').trim().split('\n').length, 2);
}));
test('fails closed on live lock without modifying journal', () => withFile(file => {
  const fd = openSync(file + '.lock', 'wx');
  try { assert.throws(() => appendJournalEvent(file, {eventId:'x'}, 0), /Journal busy/); }
  finally { closeSync(fd); unlinkSync(file+'.lock'); }
  assert.equal(existsSync(file), false);
}));
test('fails closed on incomplete journal record', () => withFile(file => {
  writeFileSync(file, '{"eventId":"one"}');
  assert.throws(() => appendJournalEvent(file, {eventId:'two'}, 1, 'one'), /Incomplete journal/);
}));
test('rejects equal count but wrong tail', () => withFile(file => {
  appendJournalEvent(file, {eventId:'one'}, 0);
  assert.throws(() => appendJournalEvent(file, {eventId:'two'}, 1, 'wrong'), /checkpoint mismatch/i);
}));
test('rejects malformed checkpoint and event without writing', () => withFile(file => {
  assert.throws(() => appendJournalEvent(file, {eventId:'x'}, -1), /Invalid journal checkpoint/);
  assert.throws(() => appendJournalEvent(file, {}, 0), /Invalid journal event/);
  assert.equal(existsSync(file), false);
}));
test('does not silently discard blank records from journal', () => withFile(file => {
  writeFileSync(file, '{"eventId":"one"}\n\n');
  assert.throws(() => appendJournalEvent(file, {eventId:'two'}, 1, 'one'), /Stale queue snapshot/);
}));
test('releases owned lock after checkpoint failure', () => withFile(file => {
  appendJournalEvent(file, {eventId:'one'}, 0);
  assert.throws(() => appendJournalEvent(file, {eventId:'two'}, 1, 'bad'), /checkpoint mismatch/i);
  assert.equal(existsSync(file+'.lock'), false);
  appendJournalEvent(file, {eventId:'two'}, 1, 'one');
}));
