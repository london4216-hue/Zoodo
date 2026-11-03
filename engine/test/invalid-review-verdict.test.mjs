import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA='a'.repeat(40);
function fixture(fn){
  const dir=mkdtempSync(join(tmpdir(),'zoo-review-verdict-'));
  const file=join(dir,'queue.jsonl');
  try {
    const q=new DurableQueue(file,{now:()=>100000,leaseMs:1000,maxAttempts:2});
    q.create({id:'A',repo:'Zoodo',description:'Reject malformed review verdict'});
    q.claim('A',{worker:'invocation-1',provider:'builder'});
    q.start('A','invocation-1');
    q.submit('A','invocation-1',{commit:SHA,evidence:'https://github.com/example/pull/1'});
    fn(q,file);
  } finally {rmSync(dir,{recursive:true,force:true});}
}
const review=approved=>({reviewer:'independent',provider:'reviewer-provider',commit:SHA,evidence:'https://github.com/example/review/1',approved});

test('missing or malformed review verdict cannot silently requeue a submitted ticket',()=>fixture((q,file)=>{
  const before=readFileSync(file,'utf8');
  for(const verdict of [undefined,null,'false',0,1,{},'true']) {
    assert.throws(()=>q.approve('A',review(verdict)),/Boolean review verdict required/);
    assert.equal(readFileSync(file,'utf8'),before,'invalid verdict must not append a journal event');
    assert.equal(q.get('A').status,'review');
    assert.equal(q.get('A').commit,SHA);
    assert.equal(q.get('A').attempts,1);
  }
}));

test('explicit false review still rejects and releases the ticket for a new invocation',()=>fixture((q)=>{
  assert.equal(q.approve('A',review(false)).status,'queued');
  assert.equal(q.get('A').history.at(-1).reason,'Independent reviewer rejected');
  assert.equal(q.claim('A',{worker:'invocation-2',provider:'builder'}).status,'assigned');
}));

test('explicit true review still advances to test stage with exact SHA',()=>fixture((q)=>{
  assert.equal(q.approve('A',review(true)).status,'test');
  assert.equal(q.get('A').commit,SHA);
}));
