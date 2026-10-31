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
