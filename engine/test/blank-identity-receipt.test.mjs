import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';
const SHA='a'.repeat(40);
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'zoo-blank-identity-'));const file=join(dir,'queue.jsonl');try{fn(new DurableQueue(file,{now:()=>100000,leaseMs:1000}),file)}finally{rmSync(dir,{recursive:true,force:true})}}
test('blank worker or provider cannot acquire a durable lease or write a claim event',()=>fixture((q,file)=>{
 q.create({id:'A',repo:'Zoodo',description:'Nonblank identity'});
 const before=readFileSync(file,'utf8');
 assert.throws(()=>q.claim('A',{worker:'  ',provider:'native'}),/Real worker identity/);
 assert.throws(()=>q.claim('A',{worker:'worker-1',provider:' \t '}),/Real worker identity/);
 assert.equal(readFileSync(file,'utf8'),before);
 assert.equal(q.get('A').attempts,0);
}));
test('blank review identity or evidence cannot approve or reject a submitted commit',()=>fixture((q,file)=>{
 q.create({id:'B',repo:'Zoodo',description:'Nonblank reviewer'});
 q.claim('B',{worker:'worker-1',provider:'builder'});
 q.start('B','worker-1');q.submit('B','worker-1',{commit:SHA,evidence:'https://github.com/example/pull/1'});
 const before=readFileSync(file,'utf8');
 assert.throws(()=>q.approve('B',{reviewer:'\n ',provider:'review',commit:SHA,evidence:'review',approved:true}),/Independent exact-commit/);
 assert.throws(()=>q.approve('B',{reviewer:'reviewer',provider:'\t',commit:SHA,evidence:'review',approved:true}),/Independent exact-commit/);
 assert.throws(()=>q.approve('B',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:' ',approved:true}),/Independent exact-commit/);
 assert.equal(readFileSync(file,'utf8'),before);
 assert.equal(q.get('B').status,'review');
}));
test('blank submission or test receipt cannot be persisted',()=>fixture((q,file)=>{
 q.create({id:'C',repo:'Zoodo',description:'Nonblank receipt'});
 q.claim('C',{worker:'worker-1',provider:'builder'});q.start('C','worker-1');
 assert.throws(()=>q.submit('C','worker-1',{commit:SHA,evidence:'\n  '}),/Exact commit SHA and evidence/);
 q.submit('C','worker-1',{commit:SHA,evidence:'https://github.com/example/pull/1'});
 q.approve('C',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:'review',approved:true});
 assert.throws(()=>q.tested('C',{passed:true,evidence:'  '}),/Test verdict and evidence/);
 assert.equal(q.get('C').status,'test');
}));
