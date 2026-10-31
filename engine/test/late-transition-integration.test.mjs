import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRelay} from '../ops/relay/portable-relay.mjs';

const SECRET='worker-secret-is-long-enough-123';
const LEASE='00000000-0000-4000-8000-000000000001';
const SHA='a'.repeat(40);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const config=store=>makeRelay({
  store,workers:[{id:'worker',url:'https://example.org/worker',token:SECRET}],
  transitionDeadlineMs:15,nextDeadlineMs:30,
  fetchImpl:async()=>{throw Error('worker must not be invoked');}
});

test('late completion commit never triggers a worker after callback deadline',async()=>{
  const gate=deferred();let claims=0;
  const relay=config({complete:()=>gate.promise,claim:async()=>{claims++;return null;}});
  const result=await relay.completed({ticket_id:'T1',worker:'worker',lease_token:LEASE,commit_sha:SHA,test_url:'https://example.org/tests/T1'});
  assert.equal(result.state,'completion-unconfirmed');
  gate.resolve(true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(claims,0);
});

test('late non-execution requeue never triggers a worker after callback deadline',async()=>{
  const gate=deferred();let claims=0;
  const relay=config({notStarted:()=>gate.promise,claim:async()=>{claims++;return null;}});
  const result=await relay.notStarted({ticket_id:'T1',worker:'worker',lease_token:LEASE,evidence_url:'https://example.org/not-started/T1'});
  assert.equal(result.state,'requeue-unconfirmed');
  gate.resolve(true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(claims,0);
});

test('durably confirmed transition still immediately attempts NEXT',async()=>{
  let claims=0;
  const relay=config({complete:async()=>true,claim:async()=>{claims++;return null;}});
  const result=await relay.completed({ticket_id:'T1',worker:'worker',lease_token:LEASE,commit_sha:SHA,test_url:'https://example.org/tests/T1'});
  assert.equal(result.state,'completed');
  assert.equal(result.next.state,'idle');
  assert.equal(claims,1);
});
