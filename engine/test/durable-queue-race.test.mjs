import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';
test('two independent instances cannot both claim one journal ticket',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zoo-claim-'));
 try{
  const path=join(dir,'queue.jsonl');
  const seed=new DurableQueue(path);seed.create({id:'Z-1',repo:'Zoodo',description:'Two worker race'});
  const first=new DurableQueue(path),second=new DurableQueue(path);
  first.claim('Z-1',{worker:'builder1',provider:'one'});
  assert.throws(()=>second.claim('Z-1',{worker:'builder2',provider:'two'}),/Stale queue snapshot/);
  const restored=new DurableQueue(path);
  assert.equal(restored.get('Z-1').worker,'builder1');
  assert.equal(restored.get('Z-1').attempts,1);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
