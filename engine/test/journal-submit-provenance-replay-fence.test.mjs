import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA='a'.repeat(40);
function fixture(changes,run) {
  const dir=mkdtempSync(join(tmpdir(),'zoo-submit-replay-'));
  const file=join(dir,'journal.jsonl');
  const records=[
    {type:'create',id:'ZOO-SUBMIT-1',repo:'Zoodo',description:'Submission provenance',releaseRequired:false},
    {type:'claim',id:'ZOO-SUBMIT-1',worker:'builder-1',provider:'native-builder',leaseUntil:1100},
    {type:'start',id:'ZOO-SUBMIT-1'},
    {type:'submit',id:'ZOO-SUBMIT-1',commit:SHA,evidence:'https://github.com/example/repo/pull/1',...changes},
  ];
  const raw=records.map(x=>JSON.stringify(x)).join('\n')+'\n';
  writeFileSync(file,raw);
  try{run(file,raw)}finally{rmSync(dir,{recursive:true,force:true})}
}

for(const [name,changes] of [
  ['missing commit',{commit:null}],
  ['short commit',{commit:'a'.repeat(39)}],
  ['uppercase commit',{commit:'A'.repeat(40)}],
  ['nonnumeric commit',{commit:'z'.repeat(40)}],
  ['nonstring commit',{commit:{toString:()=>SHA}}],
  ['missing evidence',{evidence:null}],
  ['blank evidence',{evidence:'   '}],
  ['nonstring evidence',{evidence:42}],
]){
  test('replay rejects '+name+' without rewriting historical journal',()=>fixture(changes,(file,raw)=>{
    assert.throws(()=>new DurableQueue(file,{now:()=>1000,leaseMs:100}),/Invalid journal submission provenance/);
    assert.equal(readFileSync(file,'utf8'),raw);
  }));
}

test('valid persisted submission can complete exact-commit workflow',()=>fixture({},file=>{
  const q=new DurableQueue(file,{now:()=>1000,leaseMs:100});
  assert.equal(q.get('ZOO-SUBMIT-1').commit,SHA);
  assert.equal(q.approve('ZOO-SUBMIT-1',{reviewer:'reviewer-2',provider:'independent',commit:SHA,evidence:'review receipt',approved:true}).status,'test');
  q.tested('ZOO-SUBMIT-1',{passed:true,evidence:'test receipt'});
  q.verify('ZOO-SUBMIT-1',{evidence:'verify receipt'});
  assert.equal(q.done('ZOO-SUBMIT-1').status,'done');
}));
