import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA='a'.repeat(40);
function fixture(fn) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-replay-expired-'));
  const file=join(dir,'queue.jsonl');
  let clock=100000;
  const make=()=>new DurableQueue(file,{now:()=>clock,leaseMs:100});
  const setClock=value=>{clock=value;};
  const forge=(type,fields={},at=100101)=>{
    appendFileSync(file,JSON.stringify({
      eventId:'forged-'+type,type,id:'T',
      at:typeof at==='number'?new Date(at).toISOString():at,
      ...fields
    })+'\n');
  };
  try {fn({make,setClock,forge});}
  finally {rmSync(dir,{recursive:true,force:true});}
}
function claimed(q) {
  q.create({id:'T',repo:'Zoodo',description:'Expired replay protection'});
  q.claim('T',{worker:'worker-1',provider:'provider-1'});
}

test('journal replay rejects start after the original lease expired',()=>fixture(({make,forge})=>{
  const q=make();claimed(q);
  forge('start');
  assert.throws(()=>make(),/Invalid journal start/);
}));
test('journal replay rejects a late heartbeat that revives an expired lease',()=>fixture(({make,forge})=>{
  const q=make();claimed(q);
  forge('heartbeat',{leaseUntil:100201});
  assert.throws(()=>make(),/Invalid journal heartbeat/);
}));
test('journal replay rejects a late submit that turns expired work into review',()=>fixture(({make,forge})=>{
  const q=make();claimed(q);q.start('T','worker-1');
  forge('submit',{commit:SHA,evidence:'https://github.com/example/pull/1'});
  assert.throws(()=>make(),/Invalid journal submission transition/);
}));
test('journal replay rejects a malformed start timestamp',()=>fixture(({make,forge})=>{
  const q=make();claimed(q);
  forge('start',{},'not-a-timestamp');
  assert.throws(()=>make(),/Invalid journal start/);
}));
test('valid start, heartbeat and submit before their respective deadlines survive replay',()=>fixture(({make,setClock})=>{
  let q=make();claimed(q);
  setClock(100050);q.start('T','worker-1');
  setClock(100080);q.heartbeat('T','worker-1');
  setClock(100120);q.submit('T','worker-1',{commit:SHA,evidence:'https://github.com/example/pull/1'});
  q=make();
  assert.equal(q.get('T').status,'review');
  assert.equal(q.get('T').commit,SHA);
}));
