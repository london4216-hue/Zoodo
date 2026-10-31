import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {makeRelay,makeHandler,makeStore} from '../ops/relay/portable-relay.mjs';
const SHA='a'.repeat(40), SECRET='callback-secret-is-long-enough-123',WSECRET='worker-secret-is-long-enough-123';
const token=n=>String(n).padStart(8,'0')+'-0000-4000-8000-000000000001';
function fixture(){
 const tickets=[{id:'T1',asset:'lab',intent:'one',state:'queued'},{id:'T2',asset:'lab',intent:'two',state:'queued'}],events=[];let n=0;
 return {tickets,events,store:{
  async claim(w){if(tickets.some(x=>x.state==='leased'&&x.lease_owner===w))return null;const t=tickets.find(x=>x.state==='queued');if(!t)return null;t.state='leased';t.lease_owner=w;t.lease_token=token(++n);events.push('claim:'+t.id);return {...t}},
  async record(x){events.push('accept:'+x.ticket_id);return true},
  async complete(x){const t=tickets.find(y=>y.id===x.ticket_id);if(!t||t.state!=='leased'||t.lease_owner!==x.worker||t.lease_token!==x.lease_token)return false;t.state='done';events.push('done:'+t.id);return true},
  async notStarted(x){const t=tickets.find(y=>y.id===x.ticket_id);if(!t||t.state!=='leased'||t.lease_token!==x.lease_token)return false;t.state='queued';events.push('not-started:'+t.id);return true},
  async quarantine(){return 0}
 }};
}
test('real local HTTP two-ticket chain dispatches NEXT on completion event, not polling',async()=>{
 const seen=[];const s=createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;const x=JSON.parse(raw);seen.push(x);assert.equal(req.headers.authorization,'Bearer '+WSECRET);
 res.writeHead(202,{'content-type':'application/json'});res.end(JSON.stringify({accepted:true,ticket_id:x.ticket_id,idempotency_key:x.idempotency_key,receipt_url:'https://example.org/receipt/'+x.ticket_id}))});
 s.listen(0,'127.0.0.1');await once(s,'listening');
 try{
  const f=fixture(),url='http://127.0.0.1:'+s.address().port;
  const relay=makeRelay({store:f.store,workers:[{id:'w',url:url.replace('http:','https:'),token:WSECRET}],fetchImpl:(u,o)=>fetch(u.replace('https:','http:'),o)});
  const h=makeHandler({relay,callbackSecret:SECRET});
  const call=x=>h({method:'POST',headers:{authorization:'Bearer '+SECRET},body:JSON.stringify(x)});
  const first=JSON.parse((await call({type:'kick',worker:'w'})).body);assert.equal(first.state,'dispatched');assert.equal(first.ticket,'T1');
  const next=JSON.parse((await call({type:'completed',ticket_id:'T1',worker:'w',lease_token:seen[0].lease_token,commit_sha:SHA,test_url:'https://example.org/tests/1'})).body);
  assert.equal(next.next.ticket,'T2');assert.deepEqual(seen.map(x=>x.ticket_id),['T1','T2']);
  assert.equal((await call({type:'completed',ticket_id:'T1',worker:'w',lease_token:seen[0].lease_token,commit_sha:SHA,test_url:'https://example.org/tests/1'})).statusCode,409);
 }finally{await new Promise(r=>s.close(r))}
});
test('timeout is uncertain, not automatically duplicated; native non-execution can requeue',async()=>{
 const f=fixture();const relay=makeRelay({store:f.store,workers:[{id:'w',url:'https://example.org/worker',token:WSECRET}],fetchImpl:async()=>{throw Error('timeout')}});
 assert.equal((await relay.next('w')).state,'uncertain');assert.equal(f.tickets[0].state,'leased');
 assert.equal((await relay.next('w')).state,'idle'); // SQL enforces one active lease per worker
 assert.equal(f.tickets[1].state,'queued');
 const result=await relay.notStarted({ticket_id:'T1',worker:'w',lease_token:f.tickets[0].lease_token,evidence_url:'https://example.org/not-started'});
 assert.equal(result.next.ticket,'T1');
});
test('forged callback, invalid SHA and missing private credentials fail closed',async()=>{
 const f=fixture(),relay=makeRelay({store:f.store,workers:[{id:'w',url:'https://example.org/worker',token:WSECRET}]});
 const h=makeHandler({relay,callbackSecret:SECRET});
 assert.equal((await h({method:'POST',headers:{authorization:'Bearer fake'},body:'{}'})).statusCode,401);
 assert.equal((await h({method:'POST',headers:{authorization:'Bearer '+SECRET},body:JSON.stringify({type:'completed',ticket_id:'T1',worker:'w',lease_token:token(1),commit_sha:'fake',test_url:'http://example.org'})})).statusCode,409);
 assert.equal(f.events.length,0);
 assert.throws(()=>makeStore({origin:'https://example.org/',serviceRoleKey:'short'}),/service key/);
});
test('worker acceptance without durable record is UNKNOWN, never reported dispatched',async()=>{
 const f=fixture();f.store.record=async()=>false;
 const relay=makeRelay({store:f.store,workers:[{id:'w',url:'https://example.org/worker',token:WSECRET}],fetchImpl:async(u,o)=>{const x=JSON.parse(o.body);return new Response(JSON.stringify({accepted:true,ticket_id:x.ticket_id,idempotency_key:x.idempotency_key,receipt_url:'https://example.org/native'}),{status:202})}});
 assert.equal((await relay.next('w')).state,'uncertain');assert.equal(f.tickets[0].state,'leased');
});

test('uncertain primary worker does not duplicate its task and dispatches independent next ticket to replacement',async()=>{
 const accepted=[];
 const server=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw);accepted.push(body);
  res.writeHead(202,{'content-type':'application/json'});
  res.end(JSON.stringify({accepted:true,ticket_id:body.ticket_id,idempotency_key:body.idempotency_key,receipt_url:'https://example.org/native/'+body.ticket_id}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const f=fixture(),port=server.address().port;
  const relay=makeRelay({store:f.store,workers:[
   {id:'dead',url:'https://dead.example.org/task',token:WSECRET},
   {id:'replacement',url:`https://127.0.0.1:${port}/task`,token:WSECRET}
  ],fetchImpl:(url,opts)=>String(url).includes('dead.example.org')?Promise.reject(Error('worker timeout')):fetch(String(url).replace('https:','http:'),opts)});
  const result=await relay.next('dead');
  assert.equal(result.state,'uncertain');
  assert.equal(result.ticket,'T1');
  assert.equal(result.replacement?.state,'dispatched');
  assert.equal(result.replacement?.ticket,'T2');
  assert.equal(result.replacement?.worker,'replacement');
  assert.deepEqual(accepted.map(x=>x.ticket_id),['T2']);
  assert.equal(f.tickets[0].state,'leased');
  assert.equal(f.tickets[1].state,'leased');
 }finally{await new Promise(r=>server.close(r))}
});

test('busy worker kick delegates next eligible ticket to idle authorized worker',async()=>{
 const f=fixture();await f.store.claim('busy');
 const accepted=[];
 const relay=makeRelay({store:f.store,workers:[
  {id:'busy',url:'https://example.org/busy',token:WSECRET},
  {id:'idle',url:'https://example.org/idle',token:WSECRET}
 ],fetchImpl:async(url,opts)=>{
  const x=JSON.parse(opts.body);accepted.push(x);
  return new Response(JSON.stringify({accepted:true,ticket_id:x.ticket_id,idempotency_key:x.idempotency_key,receipt_url:'https://example.org/native/'+x.ticket_id}),{status:202});
 }});
 const result=await relay.next('busy');
 assert.equal(result.state,'delegated');
 assert.equal(result.replacement?.ticket,'T2');
 assert.equal(result.replacement?.worker,'idle');
 assert.deepEqual(accepted.map(x=>x.ticket_id),['T2']);
 assert.equal(f.tickets[0].state,'leased');
});

test('Keeper recovery: completed ticket remains completed when NEXT claim fails',async()=>{
 const f=fixture(),leased=await f.store.claim('w');
 f.store.claim=async()=>{throw Error('temporary storage outage')};
 const relay=makeRelay({store:f.store,workers:[{id:'w',url:'https://example.org/worker',token:WSECRET}]});
 const result=await relay.completed({ticket_id:'T1',worker:'w',lease_token:leased.lease_token,commit_sha:SHA,test_url:'https://example.org/tests/T1'});
 assert.equal(result.state,'completed');
 assert.equal(result.next.state,'recovery_required');
 assert.equal(f.tickets[0].state,'done');
});

test('Keeper recovery: non-execution requeue remains durable when NEXT fails',async()=>{
 const f=fixture(),leased=await f.store.claim('w');
 f.store.claim=async()=>{throw Error('temporary storage outage')};
 const relay=makeRelay({store:f.store,workers:[{id:'w',url:'https://example.org/worker',token:WSECRET}]});
 const result=await relay.notStarted({ticket_id:'T1',worker:'w',lease_token:leased.lease_token,evidence_url:'https://example.org/nonexecution/T1'});
 assert.equal(result.state,'requeued');
 assert.equal(result.next.state,'recovery_required');
 assert.equal(f.tickets[0].state,'queued');
});

test('authenticated outbox replay consumes wake-up only after successful NEXT dispatch',async()=>{
 const f=fixture();let acked=0;
 f.store.claimOutbox=async()=>({id:1,ticket_id:'T1',lease_token:token(1)});
 f.store.ackOutbox=async(id,lease)=>{assert.equal(id,1);assert.equal(lease,token(1));acked++;return true};
 const relay=makeRelay({store:f.store,workers:[{id:'w',url:'https://example.org/worker',token:WSECRET}],
  fetchImpl:async(url,opts)=>{const x=JSON.parse(opts.body);return new Response(JSON.stringify({accepted:true,ticket_id:x.ticket_id,idempotency_key:x.idempotency_key,receipt_url:'https://example.org/receipt/'+x.ticket_id}),{status:202})}});
 const h=makeHandler({relay,callbackSecret:SECRET});
 const response=await h({method:'POST',headers:{authorization:'Bearer '+SECRET},body:JSON.stringify({type:'replay'})});
 assert.equal(response.statusCode,200);
 assert.equal(JSON.parse(response.body).state,'acked');
 assert.equal(acked,1);
 assert.equal(f.tickets[0].state,'leased');
});

test('malformed 36-character lease cannot reach a worker or be marked complete',async()=>{
 const f=fixture();let invocations=0;
 f.store.claim=async worker=>({id:'T1',asset:'lab',intent:'synthetic',lease_owner:worker,lease_token:'-'.repeat(36)});
 const relay=makeRelay({store:f.store,workers:[{id:'w',url:'https://example.org/worker',token:WSECRET}],
  fetchImpl:async()=>{invocations++;throw Error('must not invoke worker')}});
 await assert.rejects(()=>relay.next('w'),/Invalid atomic lease/);
 await assert.rejects(()=>relay.completed({ticket_id:'T1',worker:'w',lease_token:'-'.repeat(36),commit_sha:SHA,test_url:'https://example.org/test'}),/Invalid completion/);
 await assert.rejects(()=>relay.notStarted({ticket_id:'T1',worker:'w',lease_token:'-'.repeat(36),evidence_url:'https://example.org/not-started'}),/Native non-execution receipt required/);
 assert.equal(invocations,0);
});
