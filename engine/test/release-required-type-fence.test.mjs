import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

test('releaseRequired must be a boolean, never silently coerced into a different release gate',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zoo-release-flag-'));
 const file=join(dir,'queue.jsonl');
 
 try {
  const q=new DurableQueue(file,{now:()=>100000});
  for(const invalid of ['false','true',0,1,null,[],{}]) {
   assert.throws(()=>q.create({id:'T',repo:'Zoodo',description:'Release gate',releaseRequired:invalid}),/Boolean releaseRequired required/);
   assert.equal(q.get('T'),null);
  }
  assert.equal(existsSync(file),false, 'invalid flags must never create journal events');
  assert.equal(q.create({id:'T',repo:'Zoodo',description:'Release gate',releaseRequired:false}).releaseRequired,false);
  assert.equal(q.create({id:'T',repo:'Zoodo',description:'Release gate',releaseRequired:false}).releaseRequired,false);
  assert.throws(()=>q.create({id:'T',repo:'Zoodo',description:'Release gate',releaseRequired:true}),/Idempotency collision/);
 } finally {rmSync(dir,{recursive:true,force:true})}
});
