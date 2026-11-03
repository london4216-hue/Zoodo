import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const create={eventId:'create-1',type:'create',id:'A',repo:'Zoodo',description:'Journal replay contract',releaseRequired:false,at:'2026-11-01T00:00:00.000Z'};

for(const type of ['cliam','release-authorized','__proto__']){
  test('unknown persisted journal operation '+type+' fails closed without rewriting evidence',()=>{
    const dir=mkdtempSync(join(tmpdir(),'zoo-unknown-journal-'));
    const file=join(dir,'queue.jsonl');
    try{
      const raw=JSON.stringify(create)+'\n'+JSON.stringify({eventId:'bad-2',type,id:'A',at:'2026-11-01T00:00:01.000Z'})+'\n';
      writeFileSync(file,raw);
      assert.throws(()=>new DurableQueue(file),/Unknown journal event type/);
      assert.equal(readFileSync(file,'utf8'),raw);
    }finally{rmSync(dir,{recursive:true,force:true})}
  });
}

test('valid create and claim still replay with exact worker lease',()=>{
  const dir=mkdtempSync(join(tmpdir(),'zoo-valid-journal-'));
  const file=join(dir,'queue.jsonl');
  try{
    writeFileSync(file,JSON.stringify(create)+'\n');
    const queue=new DurableQueue(file,{now:()=>100000,leaseMs:100});
    assert.equal(queue.claim('A',{worker:'invocation-1',provider:'provider-a'}).status,'assigned');
    const replay=new DurableQueue(file);
    assert.equal(replay.get('A').worker,'invocation-1');
    assert.equal(replay.get('A').leaseUntil,100100);
  }finally{rmSync(dir,{recursive:true,force:true})}
});
