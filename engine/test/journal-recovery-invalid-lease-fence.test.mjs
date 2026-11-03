import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-invalid-lease-recover-'));
  try {return fn(join(dir,'queue.jsonl'))} finally {rmSync(dir,{recursive:true,force:true})}
}
function replayClaim(file, leaseUntil) {
  const id='ZOO-96-CORRUPT',worker='invocation-1';
  const events=[
    {type:'create',id,repo:'Zoodo',description:'lease recovery integrity',releaseRequired:false},
    {type:'claim',id,worker,provider:'native-provider',leaseUntil},
  ];
  writeFileSync(file,events.map(e=>JSON.stringify(e)).join('\n')+'\n');
  return {id,worker};
}
for(const [label,leaseUntil] of [
  ['missing deadline',null],
  ['non-numeric deadline','Infinity'],
  ['numeric-string deadline','200000'],
  ['unsafe-integer deadline',Number.MAX_SAFE_INTEGER+100],
]) {
  test('malformed journal '+label+' is quarantined without redispatch',()=>fixture(file=>{
    const {id,worker}=replayClaim(file,leaseUntil);
    const make=()=>new DurableQueue(file,{now:()=>100000,leaseMs:1000});
    const q=make();
    assert.equal(q.recover().length,1,'malformed active lease must be explicitly isolated');
    assert.equal(q.get(id).status,'blocked','uncertain worker must not become a fresh queued task');
    assert.equal(q.get(id).worker,worker,'preserve worker identity for quarantine fencing');
    assert.equal(make().get(id).status,'blocked','quarantine survives restart');
    assert.equal(make().recover().length,0,'no repeated quarantine records');
    assert.throws(()=>q.start(id,worker),/No active lease/);
    assert.throws(()=>q.claim(id,{worker:'replacement-2',provider:'other'}),/not queued/);
    q.create({id:'ZOO-96-NEXT',repo:'Zoodo',description:'unrelated ready work'});
    assert.throws(()=>q.claim('ZOO-96-NEXT',{worker,provider:'native-provider'}),/active ticket/,
      'quarantined invocation must not claim a second ticket');
    assert.equal(q.claim('ZOO-96-NEXT',{worker:'independent-2',provider:'other'}).status,'assigned',
      'unrelated work can continue');
  }));
}
test('well-formed expired lease recovers to queue for a new invocation',()=>fixture(file=>{
  const q=new DurableQueue(file,{now:()=>100000,leaseMs:1000});
  q.create({id:'ZOO-96-EXPIRED',repo:'Zoodo',description:'normal expiry'});
  q.claim('ZOO-96-EXPIRED',{worker:'old-1',provider:'provider-a'});
  const late=new DurableQueue(file,{now:()=>101001,leaseMs:1000});
  assert.equal(late.recover()[0].status,'queued');
  assert.equal(late.claim('ZOO-96-EXPIRED',{worker:'new-2',provider:'provider-b'}).status,'assigned');
}));
test('well-formed active lease is not quarantined or recovered',()=>fixture(file=>{
  const q=new DurableQueue(file,{now:()=>100000,leaseMs:1000});
  q.create({id:'ZOO-96-ACTIVE',repo:'Zoodo',description:'active lease'});
  q.claim('ZOO-96-ACTIVE',{worker:'worker-1',provider:'provider-a'});
  assert.equal(q.recover().length,0);
  assert.equal(q.get('ZOO-96-ACTIVE').status,'assigned');
}));
