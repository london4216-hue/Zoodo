import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {makeRelay,makeHandler} from '../ops/relay/portable-relay.mjs';
const LEASE='11111111-1111-4111-8111-111111111111';
const SECRET='long-enough-callback-secret-123456';
const TOKEN='long-enough-worker-secret-123456';
const SHA='a'.repeat(40);

async function withWorker(run){
 const accepted=[];
 const server=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;
  const x=JSON.parse(raw);accepted.push({ticket:x.ticket_id,at:performance.now()});
  res.writeHead(202,{'content-type':'application/json'});
  res.end(JSON.stringify({accepted:true,ticket_id:x.ticket_id,idempotency_key:x.idempotency_key,receipt_url:'https://example.org/native/'+x.ticket_id}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{return await run({url:`https://127.0.0.1:${server.address().port}/run`,accepted})}
 finally{await new Promise(resolve=>server.close(resolve))}
}
const localFetch=(url,opts)=>fetch(String(url).replace('https:','http:'),opts);

test('actual localhost HTTP two-ticket completion immediately triggers NEXT with durable record',async()=>withWorker(async({url,accepted})=>{
 const tickets=[{id:'T1',state:'queued'},{id:'T2',state:'queued'}],records=[];
 const store={
  async claim(worker){const t=tickets.find(x=>x.state==='queued');if(!t)return null;
   t.state='leased';t.lease_owner=worker;t.lease_token=LEASE;return {...t,asset:'synthetic',intent:'test'}},
  async record(x){records.push(x.ticket_id);return true},
  async complete(x){const t=tickets.find(y=>y.id===x.ticket_id);t.state='done';return true}
 };
 const relay=makeRelay({store,workers:[{id:'w',url,token:TOKEN}],fetchImpl:localFetch,nextDeadlineMs:2000});
 const handler=makeHandler({relay,callbackSecret:SECRET});
 const call=x=>handler({method:'POST',headers:{authorization:'Bearer '+SECRET},body:JSON.stringify(x)});
 const first=JSON.parse((await call({type:'kick',worker:'w'})).body);
 assert.equal(first.ticket,'T1');
 const completedAt=performance.now();
 const second=JSON.parse((await call({type:'completed',ticket_id:'T1',worker:'w',lease_token:LEASE,commit_sha:SHA,test_url:'https://example.org/test/T1'})).body);
 const latencyMs=performance.now()-completedAt;
 assert.equal(second.next.ticket,'T2');assert.ok(latencyMs<2000);
 console.log(JSON.stringify({kind:'local-two-ticket-next',ticket_1:'T1',ticket_2:'T2',completion_to_next_callback_ms:Number(latencyMs.toFixed(3)),completion_to_next_worker_accept_ms:Number((accepted.find(x=>x.ticket==='T2').at-completedAt).toFixed(3)),provider:'localhost-http',hosted:false}));
 assert.deepEqual(accepted.map(x=>x.ticket),['T1','T2']);
 assert.deepEqual(records,['T1','T2']);assert.equal(tickets[0].state,'done');assert.equal(tickets[1].state,'leased');
}));

test('actual localhost HTTP replacement dispatches independent T2 and quarantines uncertain T1',async()=>withWorker(async({url,accepted})=>{
 const tickets=[{id:'T1',state:'queued'},{id:'T2',state:'queued'}],records=[];
 const store={
  async claim(worker){if(tickets.some(x=>x.state==='leased'&&x.lease_owner===worker))return null;
   const t=tickets.find(x=>x.state==='queued');if(!t)return null;
   t.state='leased';t.lease_owner=worker;t.lease_token=LEASE;return {...t,asset:'synthetic',intent:'test'}},
  async record(x){records.push(x.ticket_id);return true}
 };
 const relay=makeRelay({store,workers:[{id:'dead',url:'https://dead.example.org/run',token:TOKEN},{id:'backup',url,token:TOKEN}],
  fetchImpl:(target,opts)=>String(target).includes('dead.example.org')?Promise.reject(Error('synthetic worker outage')):localFetch(target,opts)});
 const result=await relay.next('dead');
 assert.equal(result.state,'uncertain');assert.equal(result.ticket,'T1');
 assert.equal(result.replacement?.state,'dispatched');assert.equal(result.replacement?.ticket,'T2');
 assert.deepEqual(accepted.map(x=>x.ticket),['T2']);assert.deepEqual(records,['T2']);
 assert.equal(tickets[0].state,'leased');assert.equal(tickets[1].state,'leased');
 console.log(JSON.stringify({kind:'local-failover',failed_worker:'dead',replacement_worker:'backup',uncertain_ticket:'T1',dispatched_ticket:'T2',provider:'localhost-http',hosted:false}));
}));
