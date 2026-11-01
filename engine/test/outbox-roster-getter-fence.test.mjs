import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function fixture() {
  const calls=[];
  return {
    calls,
    store:{claimOutbox:async()=>{calls.push('claim');return lease;},ackOutbox:async()=>{calls.push('ack');return true;}},
    relay:{next:async worker=>{calls.push(['next',worker]);return {state:'dispatched',ticket:'T1',worker,receipt_url:'https://runner.example/receipt/T1'};}}
  };
}

test('changing roster getter cannot inject an unqualified worker after validation',async()=>{
  const f=fixture();let reads=0;const roster=['workerA'];
  Object.defineProperty(roster,0,{get(){reads++;return reads>=3?'bad worker':'workerA';},configurable:true});
  const result=await drainOne({...f,workerIds:roster});
  assert.equal(result.state,'acknowledged');
  assert.deepEqual(f.calls,['claim',['next','workerA'],'ack'],'dispatch only the validated snapshot');
  assert.equal(reads,1,'read each roster entry exactly once');
});

test('changing roster getter cannot inject duplicate worker after validation',async()=>{
  const f=fixture();let reads=0;const roster=['workerA','workerB'];
  Object.defineProperty(roster,1,{get(){reads++;return reads>=3?'workerA':'workerB';},configurable:true});
  f.relay.next=async worker=>{f.calls.push(['next',worker]);return worker==='workerA'?{state:'idle'}:{state:'dispatched',ticket:'T1',worker,receipt_url:'https://runner.example/receipt/T1'};};
  f.store.settleIdleOutbox=async()=>false;
  const result=await drainOne({...f,workerIds:roster});
  assert.equal(result.state,'acknowledged');
  assert.deepEqual(f.calls,['claim',['next','workerA'],['next','workerB'],'ack'],'second worker must be the validated distinct worker');
  assert.equal(reads,1,'read each roster entry exactly once');
});

test('stable qualified roster still dispatches normally',async()=>{
  const f=fixture();const result=await drainOne({...f,workerIds:['workerA','workerB']});
  assert.equal(result.state,'acknowledged');
  assert.deepEqual(f.calls,['claim',['next','workerA'],'ack']);
});
