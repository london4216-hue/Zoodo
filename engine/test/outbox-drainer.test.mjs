import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';
const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture({result={state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:'https://runner.example/receipts/T1'},ack=true,settle=true}={}){
 const calls=[];
 const store={claimOutbox:async()=>{calls.push('claim');return lease},
   ackOutbox:async(...x)=>{calls.push(['ack',...x]);return ack},
   settleIdleOutbox:async(...x)=>{calls.push(['settle',...x]);return settle}};
 const relay={next:async w=>{calls.push(['next',w]);return typeof result==='function'?result(w):result}};
 return {store,relay,calls};
}
test('empty durable queue performs no dispatch',async()=>{
 const f=fixture();f.store.claimOutbox=async()=>null;
 assert.deepEqual(await drainOne({...f,workerIds:['workerA']}),{state:'empty'});assert.deepEqual(f.calls,[]);
});
test('ack follows authenticated dispatch, never precedes it',async()=>{
 const f=fixture();const r=await drainOne({...f,workerIds:['workerA']});
 assert.equal(r.state,'acknowledged');assert.deepEqual(f.calls,['claim',['next','workerA'],['ack',7,lease.lease_token]]);
});
test('idle settles only after transactional empty-queue confirmation',async()=>{
 const f=fixture({result:{state:'idle'}});assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'idle-settled');
 assert.deepEqual(f.calls,['claim',['next','workerA'],['settle',7,lease.lease_token]]);
});
test('idle with queued work or missing settle RPC never ACKs',async()=>{
 const f=fixture({result:{state:'idle'},settle:false});assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'recovery_required');
 assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='ack'),false);
 delete f.store.settleIdleOutbox;assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'recovery_required');
});
test('failed worker tries qualified alternative without acking failure',async()=>{
 const f=fixture({result:w=>w==='workerA'?{state:'recovery_required'}:{state:'dispatched',ticket:'T2',worker:w,receipt_url:'https://runner.example/receipts/T2'}});
 const r=await drainOne({...f,workerIds:['workerA','workerB']});assert.equal(r.state,'acknowledged');
 assert.deepEqual(r.attempts,[{worker:'workerA',state:'recovery_required'},{worker:'workerB',state:'dispatched'}]);
});
test('uncertain native dispatch does not fake success or ack',async()=>{
 const f=fixture({result:{state:'uncertain',ticket:'T1'}});
 const r=await drainOne({...f,workerIds:['workerA']});assert.equal(r.state,'recovery_required');
 assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='ack'),false);
});
test('independent alternate dispatch does not certify original uncertain job',async()=>{
 const f=fixture({result:{state:'uncertain',replacement:{state:'dispatched',ticket:'T2'}}});
 assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'recovery_required');
 assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='ack'),false);
});
test('failed durable ack does not report acknowledged',async()=>{
 const f=fixture({ack:false});assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'recovery_required');
});
test('rejects unqualified workers, malformed token and missing ticket',async()=>{
 const f=fixture();await assert.rejects(drainOne({...f,workerIds:['bad worker']}));
 f.store.claimOutbox=async()=>({id:7,ticket_id:'T1',lease_token:'-'.repeat(36)});
 await assert.rejects(drainOne({...f,workerIds:['workerA']}),/Invalid durable outbox lease/);
 f.store.claimOutbox=async()=>({id:7,lease_token:lease.lease_token});
 await assert.rejects(drainOne({...f,workerIds:['workerA']}),/Invalid durable outbox lease/);
});
test('does not claim success for undefined worker result',async()=>{
 const f=fixture({result:undefined});f.relay.next=async()=>undefined;
 assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'recovery_required');
});

test('rejects unsubstantiated dispatch/delegation without ACK',async()=>{
 for(const result of [
  {state:'dispatched'},
  {state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:'http://insecure.example/receipt'},
  {state:'delegated',worker:'workerA'},
  {state:'delegated',worker:'workerA',replacement:{state:'dispatched'}}
 ]){
  const f=fixture({result});const r=await drainOne({...f,workerIds:['workerA']});
  assert.equal(r.state,'recovery_required');
  assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='ack'),false);
 }
});
test('delegated dispatch ACK requires complete alternate receipt',async()=>{
 const f=fixture({result:{state:'delegated',worker:'workerA',replacement:{state:'dispatched',ticket:'T2',worker:'workerB',receipt_url:'https://runner.example/receipts/T2'}}});
 assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'acknowledged');
});
test('ambiguous durable ACK exception never triggers second worker dispatch',async()=>{
 const f=fixture({result:w=>({state:'dispatched',ticket:'T1',worker:w,receipt_url:'https://runner.example/receipts/T1'})});
 f.store.ackOutbox=async()=>{throw Error('ACK timeout')};
 const r=await drainOne({...f,workerIds:['workerA','workerB']});
 assert.equal(r.state,'recovery_required');
 assert.deepEqual(f.calls.filter(x=>Array.isArray(x)&&x[0]==='next'),[['next','workerA']]);
});
test('uncertain worker response never dispatches another worker without native non-started proof',async()=>{
 const f=fixture({result:w=>w==='workerA'?{state:'uncertain',ticket:'T1'}:{state:'dispatched',ticket:'T2',worker:w,receipt_url:'https://runner.example/receipt/T2'}});
 const r=await drainOne({...f,workerIds:['workerA','workerB']});
 assert.equal(r.state,'recovery_required');
 assert.deepEqual(f.calls.filter(x=>Array.isArray(x)&&x[0]==='next'),[['next','workerA']]);
 assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='ack'),false);
});
test('thrown worker invocation is uncertain, not evidence that a replacement is safe',async()=>{
 const f=fixture();f.relay.next=async w=>{f.calls.push(['next',w]);throw Error('network timeout')};
 const r=await drainOne({...f,workerIds:['workerA','workerB']});
 assert.equal(r.state,'recovery_required');
 assert.deepEqual(f.calls.filter(x=>Array.isArray(x)&&x[0]==='next'),[['next','workerA']]);
});
test('rejects receipt for another worker and embedded credentials',async()=>{
 for(const result of [
  {state:'dispatched',ticket:'T1',worker:'workerB',receipt_url:'https://runner.example/r'},
  {state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:'https://user:secret@runner.example/r'},
  {state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:'https://runner.example/r#fragment'},
  {state:'delegated',worker:'workerA',replacement:{state:'dispatched',ticket:'T2',worker:'workerA',receipt_url:'https://runner.example/r'}}
 ]) {
  const f=fixture({result});const r=await drainOne({...f,workerIds:['workerA','workerB']});
  assert.equal(r.state,'recovery_required');
  assert.equal(f.calls.some(x=>Array.isArray(x)&&x[0]==='ack'),false);
 }
});
