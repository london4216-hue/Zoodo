import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

// The journal is persisted input: an invalid lease deadline must never
// become a valid active worker merely through JavaScript numeric coercion.
for (const [name,leaseUntil] of [
  ['non-numeric lease deadline','Infinity'],
  ['numeric string lease deadline','200000'],
  ['unsafe integer lease deadline',Number.MAX_SAFE_INTEGER+100],
]) {
  test('journal replay rejects '+name+' before worker start',()=>{
    const dir=mkdtempSync(join(tmpdir(),'zoo-journal-lease-'));
    try {
      const id='ZOO-96-JOURNAL', worker='native-worker-1';
      const file=join(dir,'queue.jsonl');
      const records=[
        {type:'create',id,repo:'Zoodo',description:'journal lease integrity',releaseRequired:false},
        {type:'claim',id,worker,provider:'native-provider',leaseUntil},
      ];
      writeFileSync(file,records.map(x=>JSON.stringify(x)).join('\n')+'\n');
      const q=new DurableQueue(file,{now:()=>100000,leaseMs:1000});
      assert.throws(()=>q.start(id,worker),/No active lease/);
      assert.throws(()=>q.heartbeat(id,worker),/No active lease/);
      assert.equal(q.get(id).status,'assigned','invalid lease cannot start work');
    } finally {rmSync(dir,{recursive:true,force:true})}
  });
}

test('valid numeric journal lease remains eligible before expiry',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zoo-journal-lease-valid-'));
  try {
    const q=new DurableQueue(join(dir,'queue.jsonl'),{now:()=>100000,leaseMs:1000});
    q.create({id:'ZOO-96-VALID',repo:'Zoodo',description:'valid numeric lease'});
    q.claim('ZOO-96-VALID',{worker:'native-worker-1',provider:'native-provider'});
    assert.equal(q.start('ZOO-96-VALID','native-worker-1').status,'running');
  } finally {rmSync(dir,{recursive:true,force:true})}
});
