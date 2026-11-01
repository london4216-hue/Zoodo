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
  test('recovery fails closed on malformed active lease '+String(malformed),()=>fixture(file=>{
    corruptClaim(file,'A',malformed);
    const q=new DurableQueue(file,{now:()=>1100,leaseMs:100});
    const before=readFileSync(file,'utf8');
    assert.throws(()=>q.recover(),/Invalid active lease deadline/);
    assert.equal(readFileSync(file,'utf8'),before,'no journal mutation');
    assert.equal(q.get('A').status,'assigned');
    assert.equal(q.get('B').status,'assigned','valid lease must not be partially recovered');
  }));
}

test('valid expired leases still recover together',()=>fixture(file=>{
  const q=new DurableQueue(file,{now:()=>1100,leaseMs:100});
  assert.equal(q.recover().length,2);
  assert.equal(q.get('A').status,'queued');
  assert.equal(q.get('B').status,'queued');
}));
