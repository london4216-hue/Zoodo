import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA='a'.repeat(40);
const event=(type,fields={})=>({eventId:type+'-'+Math.random().toString(36).slice(2),type,id:'A',at:'2026-11-01T12:00:00.000Z',...fields});
const base=()=>[
  event('create',{repo:'Zoodo',description:'Synthetic replay evidence',releaseRequired:false}),
  event('claim',{worker:'builder-1',provider:'builder',leaseUntil:100200}),
  event('start'),
  event('submit',{commit:SHA,evidence:'https://github.com/example/pull/1'})
];
const approval=()=>event('approve',{reviewer:'reviewer-1',reviewProvider:'review',commit:SHA,evidence:'https://github.com/example/review/1'});
const tests=()=>event('tested',{passed:true,evidence:'https://github.com/example/actions/1'});
function replay(events){
  const dir=mkdtempSync(join(tmpdir(),'zoo-replay-evidence-'));
  try{
    const file=join(dir,'queue.jsonl');
    writeFileSync(file,events.map(e=>JSON.stringify(e)).join('\n')+'\n');
    return new DurableQueue(file,{now:()=>100000,leaseMs:100,maxAttempts:3});
  }finally{rmSync(dir,{recursive:true,force:true})}
}
test('replay rejects missing reviewer identity',()=>assert.throws(()=>replay([...base(),{...approval(),reviewer:null}]),/Invalid journal approval provenance/));
test('replay rejects same-provider self review',()=>assert.throws(()=>replay([...base(),{...approval(),reviewProvider:'builder'}]),/Invalid journal approval provenance/));
test('replay rejects approval for another commit',()=>assert.throws(()=>replay([...base(),{...approval(),commit:'b'.repeat(40)}]),/Invalid journal approval provenance/));
test('replay rejects blank review evidence',()=>assert.throws(()=>replay([...base(),{...approval(),evidence:'   '}]),/Invalid journal approval provenance/));
test('replay rejects nonboolean test verdict',()=>assert.throws(()=>replay([...base(),approval(),{...tests(),passed:'true'}]),/Invalid journal test evidence/));
test('replay rejects blank test evidence',()=>assert.throws(()=>replay([...base(),approval(),{...tests(),evidence:'   '}]),/Invalid journal test evidence/));
test('valid approved and tested journal still replays',()=>{
  const q=replay([...base(),approval(),tests()]);
  assert.equal(q.get('A').status,'test');
  assert.equal(q.get('A').tests.passed,true);
});
