import test from 'node:test';
import assert from 'node:assert/strict';
import {nextWithDeadline} from '../ops/relay/next-deadline.mjs';

test('deadline aborts its signal and prevents a late NEXT launch', async () => {
  let releaseClaim, startedWorker = 0, signalled;
  const lateClaim = new Promise(resolve => {releaseClaim = resolve});
  const result = await nextWithDeadline(async signal => {
    signalled = signal;
    await lateClaim;
    if (!signal.aborted) startedWorker++;
    return {state:'dispatched'};
  },{timeoutMs:15});
  assert.equal(result.state,'next-unconfirmed');
  assert.equal(signalled.aborted,true);
  releaseClaim();
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(startedWorker,0);
});

test('fast NEXT receives live signal and returns verified result',async()=>{
  const result=await nextWithDeadline(async signal=>{
    assert.equal(signal.aborted,false);
    return {state:'dispatched',ticket:'T2'};
  },{timeoutMs:100});
  assert.deepEqual(result,{state:'dispatched',ticket:'T2'});
});

import {makeRelay} from '../ops/relay/portable-relay.mjs';
const LEASE='11111111-1111-4111-8111-111111111111';
const TOKEN='long-enough-worker-secret-123456';

test('completed T1 cannot launch T2 worker after NEXT deadline and late database claim',async()=>{
  let releaseClaim, invocations=0, completions=0;
  const lateClaim=new Promise(resolve=>{releaseClaim=resolve});
  const store={
    async complete(){completions++;return true},
    async claim(){return lateClaim},
    async record(){return true}
  };
  const relay=makeRelay({store,workers:[{id:'w',url:'https://worker.example.org/run',token:TOKEN}],
    nextDeadlineMs:20,fetchImpl:async()=>{invocations++;throw Error('worker should not run')}});
  const response=await relay.completed({ticket_id:'T1',worker:'w',lease_token:LEASE,
    commit_sha:'a'.repeat(40),test_url:'https://example.org/test/T1'});
  assert.equal(response.state,'completed');
  assert.equal(response.next.state,'next-unconfirmed');
  assert.equal(completions,1);
  releaseClaim({id:'T2',lease_owner:'w',lease_token:LEASE,asset:'test',intent:'test'});
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(invocations,0,'late leased T2 must not be invoked after callback deadline');
});

test('expired NEXT does not start alternate worker after late primary claim',async()=>{
  let releaseClaim, calls=0; const claimed=[];
  const store={
    async complete(){return true},
    async claim(worker){claimed.push(worker);return new Promise(resolve=>{releaseClaim=resolve})},
    async record(){return true}
  };
  const relay=makeRelay({store,workers:[
    {id:'w',url:'https://worker.example.org/run',token:TOKEN},
    {id:'backup',url:'https://backup.example.org/run',token:TOKEN}],
    nextDeadlineMs:20,fetchImpl:async()=>{calls++;throw Error('unexpected worker invocation')}});
  const response=await relay.completed({ticket_id:'T1',worker:'w',lease_token:LEASE,
    commit_sha:'a'.repeat(40),test_url:'https://example.org/test/T1'});
  assert.equal(response.next.state,'next-unconfirmed');
  releaseClaim(null);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(calls,0);
  assert.deepEqual(claimed,['w'],'expired NEXT must not claim backup worker');
});

import {makeOutboxReplay} from '../ops/relay/outbox-replay.mjs';
test('outbox replay deadline aborts late dispatch claim without acknowledging event',async()=>{
  let releaseClaim, workerCalls=0, acked=0, observedSignal;
  const lateClaim=new Promise(resolve=>{releaseClaim=resolve});
  const replay=makeOutboxReplay({
    store:{claimOutbox:async()=>({id:1,ticket_id:'T1',lease_token:LEASE}),
      ackOutbox:async()=>{acked++;return true}},
    dispatch:async(_worker,_allowReplacement,signal)=>{
      observedSignal=signal;
      await lateClaim;
      if(!signal.aborted)workerCalls++;
      return {state:'dispatched',ticket:'T2'};
    },worker:'w',timeoutMs:20
  });
  const result=await replay();
  assert.equal(result.state,'replay-unconfirmed');
  assert.equal(observedSignal?.aborted,true);
  releaseClaim();
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(workerCalls,0);
  assert.equal(acked,0);
});

import {createServer} from 'node:http';
import {once} from 'node:events';

test('real localhost two-ticket NEXT chain remains immediate and durably recorded',async()=>{
  const seen=[],recorded=[],tickets=[{id:'T1',state:'queued'},{id:'T2',state:'queued'}];
  const server=createServer(async(req,res)=>{
    let raw='';for await(const part of req)raw+=part;
    const body=JSON.parse(raw);seen.push(body.ticket_id);
    res.writeHead(202,{'content-type':'application/json'});
    res.end(JSON.stringify({accepted:true,ticket_id:body.ticket_id,idempotency_key:body.idempotency_key,
      receipt_url:'https://example.org/native/'+body.ticket_id}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const store={
      async claim(worker){const t=tickets.find(x=>x.state==='queued');if(!t)return null;
        t.state='leased';t.lease_owner=worker;t.lease_token=LEASE;return {...t,asset:'test',intent:'synthetic'}},
      async record(x){recorded.push(x.ticket_id);return true},
      async complete(x){const t=tickets.find(y=>y.id===x.ticket_id);t.state='done';return true}
    };
    const relay=makeRelay({store,workers:[{id:'w',url:`https://127.0.0.1:${server.address().port}/work`,token:TOKEN}],
      nextDeadlineMs:2000,fetchImpl:(url,opts)=>fetch(String(url).replace('https:','http:'),opts)});
    const first=await relay.next('w');
    assert.equal(first.ticket,'T1');
    const completedAt=performance.now();
    const result=await relay.completed({ticket_id:'T1',worker:'w',lease_token:LEASE,
      commit_sha:'a'.repeat(40),test_url:'https://example.org/tests/T1'});
    const nextDelayMs=performance.now()-completedAt;
    assert.equal(result.next.ticket,'T2');
    assert.ok(nextDelayMs<2000,'completion triggers NEXT within callback without hourly poll');
    assert.deepEqual(seen,['T1','T2']);assert.deepEqual(recorded,['T1','T2']);
    assert.equal(tickets[0].state,'done');assert.equal(tickets[1].state,'leased');
  }finally{await new Promise(resolve=>server.close(resolve))}
});

test('real localhost replacement dispatches independent T2 after T1 worker failure',async()=>{
  const tickets=[{id:'T1',state:'queued'},{id:'T2',state:'queued'}],seen=[],recorded=[];
  const server=createServer(async(req,res)=>{
    let raw='';for await(const part of req)raw+=part;
    const x=JSON.parse(raw);seen.push(x.ticket_id);
    res.writeHead(202,{'content-type':'application/json'});
    res.end(JSON.stringify({accepted:true,ticket_id:x.ticket_id,idempotency_key:x.idempotency_key,
      receipt_url:'https://example.org/native/'+x.ticket_id}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const store={
      async claim(worker){if(tickets.some(t=>t.state==='leased'&&t.lease_owner===worker))return null;
        const t=tickets.find(x=>x.state==='queued');if(!t)return null;
        t.state='leased';t.lease_owner=worker;t.lease_token=LEASE;return {...t,asset:'test',intent:'synthetic'}},
      async record(x){recorded.push(x.ticket_id);return true}
    };
    const relay=makeRelay({store,workers:[
      {id:'dead',url:'https://dead.example.org/work',token:TOKEN},
      {id:'backup',url:`https://127.0.0.1:${server.address().port}/work`,token:TOKEN}],
      fetchImpl:(url,opts)=>String(url).includes('dead.example.org')
        ? Promise.reject(Error('synthetic primary worker unavailable'))
        : fetch(String(url).replace('https:','http:'),opts)});
    const result=await relay.next('dead');
    assert.equal(result.state,'uncertain');
    assert.equal(result.ticket,'T1');
    assert.equal(result.replacement?.state,'dispatched');
    assert.equal(result.replacement?.ticket,'T2');
    assert.deepEqual(seen,['T2']);assert.deepEqual(recorded,['T2']);
    assert.equal(tickets[0].state,'leased','uncertain T1 is not automatically duplicated');
  }finally{await new Promise(resolve=>server.close(resolve))}
});
