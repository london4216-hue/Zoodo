import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';
const SHA='a'.repeat(40);
function fixture(budget,fn){
  const dir=mkdtempSync(join(tmpdir(),'zoo-tested-replay-')),file=join(dir,'queue.jsonl');
  const make=()=>new DurableQueue(file,{now:()=>100000,leaseMs:100,maxAttempts:budget});
  try{return fn({file,make})}finally{rmSync(dir,{recursive:true,force:true})}
}
function prepare(q){
  q.create({id:'T',repo:'Zoodo',description:'Verdict replay'});
  q.claim('T',{worker:'builder',provider:'build'});
  q.start('T','builder');
  q.submit('T','builder',{commit:SHA,evidence:'commit receipt'});
  q.approve('T',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:'review receipt',approved:true});
}
for(const [name,budget,fields] of [
  ['under-budget dead-letter',3,{passed:false,dead:true}],
  ['passed test marked dead',3,{passed:true,dead:true}],
  ['exhausted failure requeued',1,{passed:false,dead:false}],
  ['missing dead verdict',3,{passed:true}],
  ['nonboolean dead verdict',3,{passed:true,dead:'false'}]
]){
  test('reject replayed '+name,()=>fixture(budget,({file,make})=>{
    prepare(make());
    appendFileSync(file,JSON.stringify({eventId:'synthetic',type:'tested',id:'T',at:'2026-11-02T07:00:00.000Z',evidence:'test receipt',...fields})+'\n');
    const before=readFileSync(file,'utf8');
    assert.throws(()=>make(),/Invalid journal test retry budget/);
    assert.equal(readFileSync(file,'utf8'),before);
  }));
}
for(const [name,budget,passed,status] of [
  ['under-budget failure',3,false,'queued'],
  ['exhausted failure',1,false,'blocked'],
  ['passed test',3,true,'test']
]){
  test('preserve replayed '+name,()=>fixture(budget,({make})=>{
    const q=make();prepare(q);q.tested('T',{passed,evidence:'real test receipt'});
    assert.equal(make().get('T').status,status);
  }));
}
