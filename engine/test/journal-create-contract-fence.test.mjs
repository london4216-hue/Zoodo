import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

for (const [name, changes] of [
  ['SQL-incompatible ticket ID', {id: 'bad/id'}],
  ['missing ticket ID', {id: null}],
  ['blank repository', {repo: '   '}],
  ['oversized description', {description: 'x'.repeat(257)}],
]) {
  test('journal replay rejects '+name+' before claiming work', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zoo-create-replay-'));
    try {
      const file = join(dir, 'queue.jsonl');
      const event = {eventId: 'legacy-create', type: 'create', id: 'T1', repo: 'Zoodo', description: 'synthetic ticket', releaseRequired: false, ...changes};
      const raw = JSON.stringify(event)+'\n';
      writeFileSync(file, raw);
      assert.throws(() => new DurableQueue(file), /Invalid journal ticket/i);
      assert.equal(readFileSync(file, 'utf8'), raw, 'replay must never rewrite the original evidence');
    } finally {rmSync(dir, {recursive:true, force:true});}
  });
}

test('valid historical journal create without releaseRequired remains readable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-create-legacy-'));
  try {
    const file = join(dir, 'queue.jsonl');
    writeFileSync(file, JSON.stringify({type:'create', id:'T1', repo:'Zoodo', description:'legacy ticket'})+'\n');
    const q = new DurableQueue(file);
    assert.equal(q.get('T1').status, 'queued');
  } finally {rmSync(dir, {recursive:true, force:true});}
});
