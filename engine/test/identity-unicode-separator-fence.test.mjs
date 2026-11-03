import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-identity-separator-'));
  try {
    const file=join(dir,'queue.jsonl');
    const q=new DurableQueue(file,{now:()=>100000,leaseMs:1000});
    return fn(q,file);
  } finally {rmSync(dir,{recursive:true,force:true});}
}
for (const [label, identity] of [
  ['nonbreaking-space worker alias','agent\u00a01'],
  ['figure-space worker alias','agent\u20071'],
  ['line-separator worker alias','agent\u20281'],
  ['paragraph-separator worker alias','agent\u20291']
]) test('rejects '+label+' without journaling',()=>fixture((q,file)=>{
  q.create({id:'ZOO-ID',repo:'Zoodo',description:'Identity fence'});
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.claim('ZOO-ID',{worker:identity,provider:'native-provider'}),/identity|provider/i);
  assert.equal(readFileSync(file,'utf8'),before);
}));
test('rejects Unicode separator provider and reviewer aliases',()=>fixture((q,file)=>{
  q.create({id:'ZOO-ID',repo:'Zoodo',description:'Identity fence'});
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.claim('ZOO-ID',{worker:'worker-1',provider:'native\u00a0provider'}),/identity|provider/i);
  assert.equal(readFileSync(file,'utf8'),before);
  q.claim('ZOO-ID',{worker:'worker-1',provider:'native-provider'});
  q.start('ZOO-ID','worker-1');
  q.submit('ZOO-ID','worker-1',{commit:'a'.repeat(40),evidence:'test receipt'});
  assert.throws(()=>q.approve('ZOO-ID',{reviewer:'review\u2007agent',provider:'review-provider',commit:'a'.repeat(40),evidence:'test review',approved:true}),/Independent/);
}));
test('preserves canonical visible Unicode identities',()=>fixture(q=>{
  q.create({id:'ZOO-ID',repo:'Zoodo',description:'Identity fence'});
  assert.equal(q.claim('ZOO-ID',{worker:'réviewer-1',provider:'provider-é'}).status,'assigned');
}));
