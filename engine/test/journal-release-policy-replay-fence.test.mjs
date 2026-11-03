import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

function withJournal(event,run) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-release-replay-'));
  const file=join(dir,'queue.jsonl');
  const raw=JSON.stringify(event)+'\n';
  writeFileSync(file,raw);
  try {run(file,raw)} finally {rmSync(dir,{recursive:true,force:true})}
}
const create=releaseRequired=>({
  type:'create',id:'ZOO-RELEASE-REPLAY',repo:'Zoodo',
  description:'Persisted release authorization',releaseRequired
});

test('persisted nonboolean release policies fail closed before queue construction',()=>{
  for(const value of ['false','true',null,0,1,[],{}]) {
    withJournal(create(value),(file,raw)=>{
      assert.throws(()=>new DurableQueue(file,{now:()=>100000}),
        /Invalid journal release requirement/);
      assert.equal(readFileSync(file,'utf8'),raw,'replay must not alter the journal');
    });
  }
});
test('persisted boolean release policies retain their exact meaning',()=>{
  for(const value of [false,true]) {
    withJournal(create(value),file=>{
      const q=new DurableQueue(file,{now:()=>100000});
      assert.equal(q.get('ZOO-RELEASE-REPLAY').releaseRequired,value);
      assert.equal(q.list().length,1);
    });
  }
});
test('legacy journal create without releaseRequired remains readable',()=>{
  const legacy={type:'create',id:'ZOO-RELEASE-REPLAY',repo:'Zoodo',
    description:'Legacy persisted ticket'};
  withJournal(legacy,file=>{
    const q=new DurableQueue(file,{now:()=>100000});
    assert.equal(q.get('ZOO-RELEASE-REPLAY').releaseRequired,undefined);
  });
});
