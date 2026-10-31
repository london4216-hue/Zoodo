import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRelay} from '../ops/relay/portable-relay.mjs';
import {nextWithDeadline} from '../ops/relay/next-deadline.mjs';
const TOKEN='00000000-0000-4000-8000-000000000001';
const SHA='a'.repeat(40);
const worker={id:'w',url:'https://example.org/worker',token:'w'.repeat(32)};
const completed={ticket_id:'T1',worker:'w',lease_token:TOKEN,commit_sha:SHA,test_url:'https://example.org/tests/T1'};
const lateTicket={id:'T2',asset:'lab',intent:'next',lease_owner:'w',lease_token:TOKEN};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('deadline exposes expiry to late NEXT continuation',async()=>{
  let release,wasExpired;
  const wait=new Promise(resolve=>{release=resolve});
  const result=await nextWithDeadline(async expired=>{await wait;wasExpired=expired();return {state:'dispatched'}},{timeoutMs:15});
  assert.equal(result.state,'next-unconfirmed');
  release();await delay(5);
  assert.equal(wasExpired,true);
});

test('late durable claim after completed callback deadline does not dispatch worker',async()=>{
  let releaseClaim,requests=0;
  const store={complete:async()=>true,claim:()=>new Promise(resolve=>{releaseClaim=resolve})};
  const relay=makeRelay({store,workers:[worker],nextDeadlineMs:15,fetchImpl:async()=>{requests++;return new Response('{}',{status:202})}});
  const result=await relay.completed(completed);
  assert.equal(result.state,'completed');assert.equal(result.next.state,'next-unconfirmed');
  releaseClaim(lateTicket);await delay(20);
  assert.equal(requests,0,'late lease must not start a new remote worker after callback deadline');
});

test('late replacement claim after callback deadline also cannot dispatch',async()=>{
  let releaseSecond,requests=0;
  const workers=[worker,{id:'backup',url:'https://example.org/backup',token:'b'.repeat(32)}];
  const store={complete:async()=>true,claim:async(w)=>w==='w'?null:new Promise(resolve=>{releaseSecond=resolve})};
  const relay=makeRelay({store,workers,nextDeadlineMs:15,fetchImpl:async()=>{requests++;return new Response('{}',{status:202})}});
  const result=await relay.completed(completed);
  assert.equal(result.next.state,'next-unconfirmed');
  releaseSecond({...lateTicket,lease_owner:'backup'});await delay(20);
  assert.equal(requests,0);
});
