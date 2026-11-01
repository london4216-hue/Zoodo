import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease={id:7,ticket_id:'T1',lease_token:'12345678-1234-4234-8234-123456789012'};
function unprintableError(){return {toString(){throw Error('nested stringify failure')}}}

test('unprintable relay rejection returns bounded recovery instead of rejecting',async()=>{
  let acks=0;
  const store={claimOutbox:async()=>lease,ackOutbox:async()=>{acks++;return true}};
  const relay={next:async()=>{throw unprintableError()}};
  const result=await drainOne({store,relay,workerIds:['workerA']});
  assert.equal(result.state,'recovery_required');
  assert.equal(result.attempts[0].state,'error');
  assert.equal(result.attempts[0].reason,'unprintable error');
  assert.equal(acks,0);
});

test('unprintable ACK exception retains explicit ACK recovery state',async()=>{
  let acks=0;
  const store={claimOutbox:async()=>lease,ackOutbox:async()=>{acks++;throw unprintableError()}};
  const relay={next:async worker=>({state:'dispatched',ticket:'T1',worker,receipt_url:'https://runner.example/T1'})};
  const result=await drainOne({store,relay,workerIds:['workerA']});
  assert.equal(result.state,'recovery_required');
  assert.equal(result.reason,'outbox ack not confirmed');
  assert.equal(result.attempts[1].state,'ack_error');
  assert.equal(result.attempts[1].reason,'unprintable error');
  assert.equal(acks,1);
});
