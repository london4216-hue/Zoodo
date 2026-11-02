import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DurableQueue} from '../src/durable-queue.mjs';

function fixture(fn){
  const dir=mkdtempSync(join(tmpdir(),'zoo-replay-fence-'));
  const file=join(dir,'queue.jsonl');
  const make=()=>new DurableQueue(file,{now:()=>100000,leaseMs:100});
  const inject=(type,fields={})=>appendFileSync(file,JSON.stringify({
    eventId:randomUUID(),type,id:'T',at:new Date(100000).toISOString(),...fields
  })+'\n');
  try {return fn({make,inject})} finally {rmSync(dir,{recursive:true,force:true})}
}

test('replay refuses a start event without an assigned lease',()=>fixture(({make,inject})=>{
  make().create({id:'T',repo:'Zoodo',description:'Synthetic replay test'});
  inject('start');
  assert.throws(()=>make(),/Invalid journal start/);
}));

test('replay refuses a heartbeat on an unclaimed ticket',()=>fixture(({make,inject})=>{
  make().create({id:'T',repo:'Zoodo',description:'Synthetic replay test'});
  inject('heartbeat',{leaseUntil:100100});
  assert.throws(()=>make(),/Invalid journal heartbeat/);
}));

test('replay refuses a malformed heartbeat deadline on an assigned ticket',()=>fixture(({make,inject})=>{
  const q=make();
  q.create({id:'T',repo:'Zoodo',description:'Synthetic replay test'});
  q.claim('T',{worker:'worker1',provider:'local'});
  inject('heartbeat',{leaseUntil:'tomorrow'});
  assert.throws(()=>make(),/Invalid journal heartbeat/);
}));

test('valid start and heartbeat survive journal restart',()=>fixture(({make})=>{
  const q=make();
  q.create({id:'T',repo:'Zoodo',description:'Synthetic replay test'});
  q.claim('T',{worker:'worker1',provider:'local'});
  q.start('T','worker1');
  q.heartbeat('T','worker1');
  assert.equal(make().get('T').status,'running');
  assert.equal(make().get('T').leaseUntil,100100);
}));
