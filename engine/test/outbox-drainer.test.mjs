import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';
const lease={id:7,lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture({result={state:'dispatched'},ack=true}={}){
 const calls=[];
 const store={outboxClaim:async()=>{calls.push('claim');return lease},outboxAck:async(...x)=>{calls.push(['ack',...x]);return ack}};
 const relay={next:async w=>{calls.push(['next',w]);return typeof result==='function'?result(w):result}};
 return {store,relay,calls};
}
test('empty durable queue performs no dispatch',async()=>{
 const f=fixture();f.store.outboxClaim=async()=>null;
 assert.deepEqual(await drainOne({...f,workerIds:['workerA']}),{state:'empty'});assert.deepEqual(f.calls,[]);
});
test('ack follows authenticated dispatch, never precedes it',async()=>{
 const f=fixture();const r=await drainOne({...f,workerIds:['workerA']});
 assert.equal(r.state,'acknowledged');assert.deepEqual(f.calls,['claim',['next','workerA'],['ack',7,lease.lease_token]]);
});
test('idle with no eligible ticket safely acknowledges wake event',async()=>{
 const f=fixture({result:{state:'idle'}});assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'acknowledged');
});
test('failed worker tries qualified alternative without acking failure',async()=>{
 const f=fixture({result:w=>w==='workerA'?{state:'recovery_required'}:{state:'dispatched',worker:w}});
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
test('rejects unqualified workers and malformed lease',async()=>{
 const f=fixture();await assert.rejects(drainOne({...f,workerIds:['bad worker']}));
 f.store.outboxClaim=async()=>({id:7,lease_token:'bad'});
 await assert.rejects(drainOne({...f,workerIds:['workerA']}));
});
