import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue} from '../src/durable-queue.mjs';
const SHA='a'.repeat(40);
function fixture(maxAttempts,fn){const dir=mkdtempSync(join(tmpdir(),'zoo-failed-tests-'));const file=join(dir,'q.jsonl');const make=()=>new DurableQueue(file,{now:()=>100000,leaseMs:100,maxAttempts});try{fn(make)}finally{rmSync(dir,{recursive:true,force:true})}}
function failedAttempt(q,worker){q.claim('A',{worker,provider:'build'});q.start('A',worker);q.submit('A',worker,{commit:SHA,evidence:'https://github.com/example/pr/1'});q.approve('A',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:'review receipt',approved:true});return q.tested('A',{passed:false,evidence:'https://github.com/example/actions/failure'});}
test('failed tests at exhausted retry budget become blocked, never queued and unclaimable after restart',()=>fixture(1,make=>{let q=make();q.create({id:'A',repo:'Zoodo',description:'Test failure at final attempt'});assert.equal(failedAttempt(q,'w1').status,'blocked');q=make();assert.equal(q.get('A').status,'blocked');assert.throws(()=>q.claim('A',{worker:'w2',provider:'build'}),/not queued/);}));
test('failed tests below budget requeue with no stale worker and allow next worker after restart',()=>fixture(2,make=>{let q=make();q.create({id:'A',repo:'Zoodo',description:'Retry after test failure'});const first=failedAttempt(q,'w1');assert.equal(first.status,'queued');assert.equal(first.worker,null);assert.equal(first.provider,null);q=make();assert.equal(q.claim('A',{worker:'w2',provider:'build'}).attempts,2);assert.equal(failedAttemptAfterClaim(q,'w2').status,'blocked');}));
function failedAttemptAfterClaim(q,worker){q.start('A',worker);q.submit('A',worker,{commit:SHA,evidence:'https://github.com/example/pr/2'});q.approve('A',{reviewer:'reviewer',provider:'review',commit:SHA,evidence:'review receipt',approved:true});return q.tested('A',{passed:false,evidence:'https://github.com/example/actions/failure2'});}
