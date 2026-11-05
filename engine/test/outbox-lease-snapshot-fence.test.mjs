import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';
const TOKEN='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function fixture(result) {
  const lease={id:7,ticket_id:'T1',lease_token:TOKEN};
  const calls=[];
  const store={claimOutbox:async()=>lease,
    ackOutbox:async(...args)=>{calls.push(['ack',...args]);return true},
    settleIdleOutbox:async(...args)=>{calls.push(['settle',...args]);return true}};
  const relay={next:async worker=>{calls.push(['next',worker]);lease.id=99;lease.lease_token=OTHER;return result(worker)}};
  return {store,relay,calls};
}
test('ACK uses original validated lease identity despite async callback mutation',async()=>{
 const f=fixture(w=>({state:'dispatched',ticket:'T1',worker:w,receipt_url:'https://runner.example/receipt'}));
 const r=await drainOne({...f,workerIds:['workerA']});
 assert.equal(r.state,'acknowledged');assert.equal(r.eventId,7);
 assert.deepEqual(f.calls,[['next','workerA'],['ack',7,TOKEN]]);
});
test('idle settlement uses original validated lease identity',async()=>{
 const f=fixture(()=>({state:'idle'}));
 const r=await drainOne({...f,workerIds:['workerA']});
 assert.equal(r.state,'idle-settled');assert.equal(r.eventId,7);
 assert.deepEqual(f.calls,[['next','workerA'],['settle',7,TOKEN]]);
});
test('uncertain response retains original event identity without ACK',async()=>{
 const f=fixture(()=>({state:'uncertain'}));
 const r=await drainOne({...f,workerIds:['workerA']});
 assert.equal(r.state,'recovery_required');assert.equal(r.eventId,7);
 assert.deepEqual(f.calls,[['next','workerA']]);
});
