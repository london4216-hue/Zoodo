import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(run, maxAttempts=2) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-test-retry-fence-'));
  const file=join(dir,'queue.jsonl');
  const make=()=>new DurableQueue(file,{now:()=>1000,leaseMs:100,maxAttempts});
  try {
    const q=make();
    q.create({id:'T',repo:'Zoodo',description:'Failed-test retry budget'});
    run({q,make,file});
  } finally {rmSync(dir,{recursive:true,force:true});}
}
function failTests(q,worker,sha) {
  q.claim('T',{worker,provider:'builder'});
  q.start('T',worker);
  q.submit('T',worker,{commit:sha,evidence:'exact SHA PR'});
  q.approve('T',{reviewer:'independent-reviewer',provider:'auditor',
    commit:sha,evidence:'independent review',approved:true});
  return q.tested('T',{passed:false,evidence:'deterministic regression failed'});
}
const lastEvent=file=>JSON.parse(readFileSync(file,'utf8').trim().split('\n').at(-1));

test('first failed test returns to READY without stale active invocation fields',()=>fixture(({q,file})=>{
  const t=failTests(q,'attempt-1','a'.repeat(40));
  assert.equal(t.status,'queued');
  assert.equal(t.worker,null);
  assert.equal(t.provider,null);
  assert.equal(t.leaseUntil,null);
  assert.equal(t.commit,null);
  assert.equal(t.reviewer,null);
  assert.equal(t.reviewProvider,null);
  assert.equal(t.tests.passed,false);
  assert.equal(lastEvent(file).dead,false);
}));

test('exhausted failed-test budget is blocked and survives journal replay',()=>fixture(({q,make,file})=>{
  failTests(q,'attempt-1','a'.repeat(40));
  const t=failTests(q,'attempt-2','b'.repeat(40));
  assert.equal(t.attempts,2);
  assert.equal(t.status,'blocked');
  assert.equal(t.worker,null);
  assert.equal(lastEvent(file).dead,true);
  const restarted=make();
  assert.equal(restarted.get('T').status,'blocked');
  const before=readFileSync(file,'utf8');
  assert.throws(()=>restarted.claim('T',{worker:'attempt-3',provider:'builder'}),/Ticket not queued/);
  assert.equal(readFileSync(file,'utf8'),before);
}));

test('legacy tested journal without dead field still replays terminal budget correctly',()=>fixture(({q,make,file})=>{
  failTests(q,'attempt-1','a'.repeat(40));
  failTests(q,'attempt-2','b'.repeat(40));
  const records=readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);
  for(const e of records)if(e.type==='tested')delete e.dead;
  writeFileSync(file,records.map(e=>JSON.stringify(e)).join('\n')+'\n');
  assert.equal(make().get('T').status,'blocked');
}));

test('passing exact-SHA test can still verify and finish',()=>fixture(({q})=>{
  q.claim('T',{worker:'attempt-1',provider:'builder'});
  q.start('T','attempt-1');
  q.submit('T','attempt-1',{commit:'c'.repeat(40),evidence:'exact SHA PR'});
  q.approve('T',{reviewer:'independent-reviewer',provider:'auditor',
    commit:'c'.repeat(40),evidence:'independent review',approved:true});
  assert.equal(q.tested('T',{passed:true,evidence:'all tests passed'}).status,'test');
  q.verify('T',{evidence:'verified commit and tests'});
  assert.equal(q.done('T').status,'done');
}));
