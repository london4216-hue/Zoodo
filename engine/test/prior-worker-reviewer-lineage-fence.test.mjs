import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';

const SHA='a'.repeat(40);
test('previous builder of same ticket cannot approve replacement build after restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zoo-review-lineage-'));
 const file=join(dir,'queue.jsonl');
 try {
  let q=new DurableQueue(file,{now:()=>100000});
  q.create({id:'T1',repo:'Zoodo',description:'Review independence'});
  q.claim('T1',{worker:'worker-original',provider:'model-A'});
  q.start('T1','worker-original');
  q.fail('T1',{worker:'worker-original',reason:'Worker failed'});
  q.claim('T1',{worker:'worker-replacement',provider:'model-B'});
  q.start('T1','worker-replacement');
  q.submit('T1','worker-replacement',{commit:SHA,evidence:'https://example.test/commit'});
  q=new DurableQueue(file,{now:()=>100000});
  assert.throws(()=>q.approve('T1',{reviewer:'worker-original',provider:'model-C',commit:SHA,evidence:'https://example.test/review',approved:true}),/Independent exact-commit review required/);
  assert.equal(q.get('T1').status,'review');
  q.approve('T1',{reviewer:'independent-reviewer',provider:'model-C',commit:SHA,evidence:'https://example.test/review',approved:true});
  assert.equal(q.get('T1').status,'test');
 } finally {rmSync(dir,{recursive:true,force:true})}
});
