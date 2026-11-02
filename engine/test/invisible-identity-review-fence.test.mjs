import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-invisible-identity-'));
  try {
    const file=join(dir,'queue.jsonl');
    const q=new DurableQueue(file,{now:()=>100000,leaseMs:1000});
    return fn({q,file});
  } finally {rmSync(dir,{recursive:true,force:true})}
}

for(const [label,worker,provider] of [
  ['zero-width worker alias','agent\u200b1','native-provider'],
  ['embedded control in worker','agent\n1','native-provider'],
  ['bidirectional format control in provider','agent1','native\u202e-provider'],
]) {
  test('claim rejects '+label+' before journal mutation',()=>fixture(({q,file})=>{
    q.create({id:'ZOO-96-ID',repo:'Zoodo',description:'Worker identity fence'});
    const before=readFileSync(file,'utf8');
    assert.throws(()=>q.claim('ZOO-96-ID',{worker,provider}),/identity|provider/i);
    assert.equal(readFileSync(file,'utf8'),before);
    assert.equal(q.get('ZOO-96-ID').status,'queued');
  }));
}

test('invisible reviewer and provider aliases cannot bypass review independence',()=>fixture(({q,file})=>{
  const commit='a'.repeat(40);
  q.create({id:'ZOO-96-REVIEW',repo:'Zoodo',description:'Independent review fence'});
  q.claim('ZOO-96-REVIEW',{worker:'builder',provider:'native-provider'});
  q.start('ZOO-96-REVIEW','builder');
  q.submit('ZOO-96-REVIEW','builder',{commit,evidence:'synthetic source receipt'});
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.approve('ZOO-96-REVIEW',{
    reviewer:'bui\u200blder',provider:'native-\u200bprovider',
    commit,evidence:'synthetic review',approved:true
  }),/Independent/);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('ZOO-96-REVIEW').status,'review');
  assert.equal(q.approve('ZOO-96-REVIEW',{
    reviewer:'independent-reviewer',provider:'independent-provider',
    commit,evidence:'synthetic review',approved:true
  }).status,'test');
}));

test('visible Unicode identities remain supported',()=>fixture(({q})=>{
  q.create({id:'ZOO-96-VISIBLE',repo:'Zoodo',description:'Visible identity'});
  assert.equal(q.claim('ZOO-96-VISIBLE',{
    worker:'réviewer-1',provider:'provider-é'
  }).status,'assigned');
}));
