import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';
const SHA='a'.repeat(40);
function fixture(fn){const dir=mkdtempSync(join(tmpdir(),'zoo-stale-commit-'));const file=join(dir,'q.jsonl');const make=()=>new DurableQueue(file,{now:()=>100000,leaseMs:100,maxAttempts:2});try{fn(make)}finally{rmSync(dir,{recursive:true,force:true})}}
function submitted(q,id){q.create({id,repo:'Zoodo',description:'Evidence isolation'});q.claim(id,{worker:'builder',provider:'build'});q.start(id,'builder');q.submit(id,'builder',{commit:SHA,evidence:'https://github.com/example/pull/1'});}
test('rejected review clears active commit and retains historical submitted SHA across restart',()=>fixture(make=>{let q=make();submitted(q,'A');assert.equal(q.get('A').commit,SHA);q.approve('A',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:'https://github.com/example/review/1',approved:false});q=make();assert.equal(q.get('A').status,'queued');assert.equal(q.get('A').commit,null);assert.equal(q.get('A').history.find(e=>e.type==='submit').commit,SHA);}));
test('failed test clears active commit and retains failure evidence across restart',()=>fixture(make=>{let q=make();submitted(q,'B');q.approve('B',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:'review receipt',approved:true});q.tested('B',{passed:false,evidence:'https://github.com/example/actions/failed'});q=make();assert.equal(q.get('B').status,'queued');assert.equal(q.get('B').commit,null);assert.deepEqual(q.get('B').tests,{passed:false,evidence:'https://github.com/example/actions/failed'});assert.equal(q.get('B').history.find(e=>e.type==='submit').commit,SHA);}));
