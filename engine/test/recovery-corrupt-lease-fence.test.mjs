import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-corrupt-lease-'));
  const file=join(dir,'queue.jsonl');
  try {
    const q=new DurableQueue(file,{now:()=>1000,leaseMs:100});
    for (const id of ['A','B']) {
      q.create({id,repo:'Zoodo',description:'test lease '+id});
      q.claim(id,{worker:'worker-'+id,provider:'provider-'+id});
    }
    return fn(file);
  } finally {rmSync(dir,{recursive:true,force:true});}
}

function corruptClaim(file,id,leaseUntil) {
  const events=readFileSync(file,'utf8').trimEnd().split('\n').map(JSON.parse);
  const claim=events.find(e=>e.type==='claim'&&e.id===id);
  assert.ok(claim,'expected claim fixture');
  claim.leaseUntil=leaseUntil;
  writeFileSync(file,events.map(e=>JSON.stringify(e)).join('\n')+'\n');
}

for (const malformed of [null,'1100',{}]) {
  test('recovery quarantines malformed active lease '+String(malformed),()=>fixture(file=>{
    corruptClaim(file,'A',malformed);
    const q=new DurableQueue(file,{now:()=>1100,leaseMs:100});
    const before=readFileSync(file,'utf8');
    assert.equal(q.recover().length,2,'quarantine malformed A and recover valid expired B');
    assert.equal(q.get('A').status,'blocked','unknown worker execution must not be requeued');
    assert.equal(q.get('A').worker,'worker-A','keep uncertain worker identity reserved');
    assert.equal(q.get('B').status,'queued','unrelated valid lease still recovers');
    const appended=readFileSync(file,'utf8').slice(before.length).trimEnd().split('\n').map(JSON.parse);
    assert.deepEqual(appended.map(e=>e.type),['quarantine','requeue']);
    assert.ok(appended.every(e=>e.at==='1970-01-01T00:00:01.100Z'),'same clock snapshot');
    const after=readFileSync(file,'utf8');
    assert.equal(q.recover().length,0,'quarantine is idempotent');
    assert.equal(readFileSync(file,'utf8'),after,'no repeat recovery writes');
    q.create({id:'C',repo:'Zoodo',description:'another ticket'});
    assert.throws(()=>q.claim('C',{worker:'worker-A',provider:'provider-A'}),/Worker already has active ticket/);
  }));
}

test('valid expired leases still recover together',()=>fixture(file=>{
  const q=new DurableQueue(file,{now:()=>1100,leaseMs:100});
  assert.equal(q.recover().length,2);
  assert.equal(q.get('A').status,'queued');
  assert.equal(q.get('B').status,'queued');
}));
