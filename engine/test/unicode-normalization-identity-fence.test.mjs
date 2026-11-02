import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const NFC = 'é';
const NFD = 'e\u0301';
const SHA = 'a'.repeat(40);
function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-nfc-identity-'));
  try {
    const file=join(dir,'queue.jsonl');
    const q=new DurableQueue(file,{now:()=>100000,leaseMs:1000});
    return fn({q,file});
  } finally {rmSync(dir,{recursive:true,force:true})}
}

test('rejects canonically equivalent decomposed worker ID before journal mutation',()=>fixture(({q,file})=>{
  q.create({id:'NFC-1',repo:'Zoodo',description:'NFC worker fence'});
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.claim('NFC-1',{worker:'agent-'+NFD,provider:'native'}),/identity|provider/i);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('NFC-1').status,'queued');
}));

test('rejects canonically equivalent decomposed provider ID before journal mutation',()=>fixture(({q,file})=>{
  q.create({id:'NFC-2',repo:'Zoodo',description:'NFC provider fence'});
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.claim('NFC-2',{worker:'agent',provider:'provider-'+NFD}),/identity|provider/i);
  assert.equal(readFileSync(file,'utf8'),before);
}));

test('decomposed reviewer alias cannot approve the same worker work',()=>fixture(({q,file})=>{
  q.create({id:'NFC-3',repo:'Zoodo',description:'NFC review fence'});
  q.claim('NFC-3',{worker:'agent-'+NFC,provider:'provider-'+NFC});
  q.start('NFC-3','agent-'+NFC);
  q.submit('NFC-3','agent-'+NFC,{commit:SHA,evidence:'synthetic source receipt'});
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.approve('NFC-3',{
    reviewer:'agent-'+NFD,provider:'provider-'+NFD,
    commit:SHA,evidence:'synthetic review',approved:true
  }),/Independent/);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('NFC-3').status,'review');
}));

test('decomposed alias cannot claim second active ticket',()=>fixture(({q,file})=>{
  q.create({id:'NFC-4A',repo:'Zoodo',description:'First worker lease'});
  q.create({id:'NFC-4B',repo:'Zoodo',description:'Second worker lease'});
  q.claim('NFC-4A',{worker:'agent-'+NFC,provider:'native'});
  const before=readFileSync(file,'utf8');
  assert.throws(()=>q.claim('NFC-4B',{worker:'agent-'+NFD,provider:'native'}),/identity|active ticket/i);
  assert.equal(readFileSync(file,'utf8'),before);
  assert.equal(q.get('NFC-4B').status,'queued');
}));

test('canonical visible Unicode worker and independent reviewer remain accepted',()=>fixture(({q})=>{
  q.create({id:'NFC-5',repo:'Zoodo',description:'Canonical Unicode accepted'});
  assert.equal(q.claim('NFC-5',{worker:'agent-'+NFC,provider:'provider-'+NFC}).status,'assigned');
  q.start('NFC-5','agent-'+NFC);
  q.submit('NFC-5','agent-'+NFC,{commit:SHA,evidence:'synthetic source receipt'});
  assert.equal(q.approve('NFC-5',{
    reviewer:'reviewer-'+NFC,provider:'independent-'+NFC,
    commit:SHA,evidence:'synthetic review',approved:true
  }).status,'test');
}));
