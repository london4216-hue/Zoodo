import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA='a'.repeat(40);
function fixture(fn){
  const dir=mkdtempSync(join(tmpdir(),'zoo-requeue-replay-'));
  const file=join(dir,'journal.jsonl');
  let now=100000;
  const make=()=>new DurableQueue(file,{now:()=>now,leaseMs:100,maxAttempts:3});
  try{return fn({file,make,setNow:value=>{now=value}})}
  finally{rmSync(dir,{recursive:true,force:true})}
}
function create(q){q.create({id:'T',repo:'Zoodo',description:'Replay transition test'})}
function assigned(q){create(q);q.claim('T',{worker:'builder',provider:'providerA'})}
function running(q){assigned(q);q.start('T','builder')}
function review(q){running(q);q.submit('T','builder',{commit:SHA,evidence:'commit receipt'})}
function verified(q){
  review(q);
  q.approve('T',{reviewer:'reviewer',provider:'providerB',commit:SHA,evidence:'review',approved:true});
  q.tested('T',{passed:true,evidence:'tests'});
  q.verify('T',{evidence:'verification'});
}
const requeue=(fields)=>({type:'requeue',...fields});
const quarantine={type:'quarantine',reason:'Malformed lease deadline; execution uncertain',worker:'builder',provider:'providerA'};
const cases=[
  ['queued forged requeue',create,requeue({reason:'Lease expired',worker:'builder',provider:'providerA',dead:false})],
  ['wrong worker requeue',running,requeue({reason:'failure',worker:'imposter',provider:'providerA',dead:false})],
  ['blank failure reason',running,requeue({reason:'',worker:'builder',provider:'providerA',dead:false})],
  ['false retry exhaustion',running,requeue({reason:'failure',worker:'builder',provider:'providerA',dead:true})],
  ['review rejection without evidence',review,requeue({reason:'Independent reviewer rejected',reviewer:'reviewer',reviewProvider:'providerB',dead:false})],
  ['verified ticket forged requeue',verified,requeue({reason:'failure',worker:'builder',provider:'providerA',dead:false})],
  ['completed ticket forged quarantine',q=>{verified(q);q.done('T')},quarantine],
  ['valid active lease forged quarantine',assigned,quarantine]
];
for(const [name,setup,event] of cases){
  test('replay rejects '+name,()=>fixture(({file,make})=>{
    setup(make());
    const forged={eventId:'forged-'+name,type:event.type,id:'T',at:'2026-11-02T06:00:00.000Z',...event};
    appendFileSync(file,JSON.stringify(forged)+'\n');
    const raw=readFileSync(file,'utf8');
    assert.throws(()=>make(),/Invalid journal (requeue|review requeue|worker requeue|quarantine)/);
    assert.equal(readFileSync(file,'utf8'),raw);
  }));
}
test('valid worker failure survives journal replay',()=>fixture(({make})=>{
  const q=make();running(q);q.fail('T',{worker:'builder',reason:'worker failure'});
  assert.equal(make().get('T').status,'queued');
}));
test('valid rejected review survives journal replay',()=>fixture(({make})=>{
  const q=make();review(q);
  q.approve('T',{reviewer:'reviewer',provider:'providerB',commit:SHA,evidence:'review',approved:false});
  assert.equal(make().get('T').status,'queued');
}));
test('valid expired lease recovery survives journal replay',()=>fixture(({make,setNow})=>{
  const q=make();assigned(q);setNow(100101);q.recover();
  assert.equal(make().get('T').status,'queued');
}));

test('malformed historical active lease is quarantined and replayable',()=>fixture(({file,make})=>{
  const q=make();create(q);
  appendFileSync(file,JSON.stringify({
    eventId:'malformed-claim',type:'claim',id:'T',
    worker:'builder',provider:'providerA',leaseUntil:'invalid',
    at:'2026-11-02T06:00:00.000Z'
  })+'\n');
  const recovered=make();
  assert.equal(recovered.get('T').status,'assigned');
  assert.equal(recovered.recover()[0].status,'blocked');
  assert.equal(make().get('T').status,'blocked');
}));
