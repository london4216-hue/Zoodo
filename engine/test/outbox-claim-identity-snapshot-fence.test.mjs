import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const TOKEN_A='12345678-1234-4234-8234-123456789012';
const TOKEN_B='87654321-4321-4321-8321-210987654321';
const receipt={state:'dispatched',ticket:'T1',worker:'workerA',receipt_url:'https://runner.example/receipts/T1'};
function fixture(event){
  const calls=[];
  return {calls,store:{claimOutbox:async()=>event,ackOutbox:async(id,token)=>{calls.push(['ack',id,token]);return true;}},relay:{next:async()=>{calls.push('dispatch');return receipt;}}};
}
test('outbox ACK uses the exact once-read event ID rather than a later getter value',async()=>{
  let reads=0;
  const event={get id(){reads++;return reads<3?7:8;},ticket_id:'T1',lease_token:TOKEN_A};
  const f=fixture(event);
  assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'acknowledged');
  assert.deepEqual(f.calls,[ 'dispatch',['ack',7,TOKEN_A]]);
  assert.equal(reads,1,'claimed event ID must be read only once');
});
test('outbox ACK uses the exact once-read lease token rather than a later getter value',async()=>{
  let reads=0;
  const event={id:7,ticket_id:'T1',get lease_token(){reads++;return reads<3?TOKEN_A:TOKEN_B;}};
  const f=fixture(event);
  assert.equal((await drainOne({...f,workerIds:['workerA']})).state,'acknowledged');
  assert.deepEqual(f.calls,[ 'dispatch',['ack',7,TOKEN_A]]);
  assert.equal(reads,1,'claimed lease token must be read only once');
});
test('outbox refuses malformed first-read identity before dispatch even if getter later returns valid',async()=>{
  let reads=0;
  const event={get id(){reads++;return reads===1?0:7;},ticket_id:'T1',lease_token:TOKEN_A};
  const f=fixture(event);
  await assert.rejects(drainOne({...f,workerIds:['workerA']}),/Invalid durable outbox lease/);
  assert.deepEqual(f.calls,[]);
});
