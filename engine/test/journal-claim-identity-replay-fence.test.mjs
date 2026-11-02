import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function replayClaim(changes, run) {
  const dir = mkdtempSync(join(tmpdir(), 'zoo-claim-identity-replay-'));
  const file = join(dir, 'journal.jsonl');
  const records = [
    {type:'create', id:'ZOO-CLAIM-1', repo:'Zoodo', description:'Replay identity fence', releaseRequired:false},
    {type:'claim', id:'ZOO-CLAIM-1', worker:'worker-1', provider:'provider-1', leaseUntil:1100, ...changes},
  ];
  const raw = records.map(e => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(file, raw);
  try {run(file, raw)} finally {rmSync(dir, {recursive:true, force:true})}
}

for (const [label,changes] of [
  ['missing worker', {worker:null}],
  ['blank worker', {worker:'   '}],
  ['padded worker', {worker:' worker-1'}],
  ['invisible worker', {worker:'worker\u200b-1'}],
  ['decomposed worker', {worker:'e\u0301'}],
  ['nonstring provider', {provider:42}],
  ['blank provider', {provider:'\t'}],
  ['padded provider', {provider:'provider-1 '}],
  ['invisible provider', {provider:'provider\u200b-1'}],
]) {
  test('journal replay rejects '+label+' without rewriting evidence', () => replayClaim(changes, (file,raw) => {
    assert.throws(() => new DurableQueue(file, {now:()=>1000,leaseMs:100}), /Invalid journal claim identity/);
    assert.equal(readFileSync(file,'utf8'),raw);
  }));
}

test('valid persisted worker and provider remain claimable for active execution', () => replayClaim({}, file => {
  const q = new DurableQueue(file, {now:()=>1000,leaseMs:100});
  assert.equal(q.get('ZOO-CLAIM-1').worker, 'worker-1');
  assert.equal(q.start('ZOO-CLAIM-1','worker-1').status, 'running');
}));

test('malformed lease deadline remains recoverable through quarantine', () => replayClaim({leaseUntil:'1100'}, file => {
  const q = new DurableQueue(file, {now:()=>1000,leaseMs:100});
  assert.equal(q.recover()[0].status,'blocked');
  assert.equal(q.get('ZOO-CLAIM-1').worker,'worker-1');
}));
