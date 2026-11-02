import test from 'node:test';
import assert from 'node:assert/strict';
import {drainOne} from '../ops/relay/outbox-drainer.mjs';

const lease = {id:1,ticket_id:'T1',lease_token:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};
function fixture() {
  const calls = {claim:0,next:[]};
  const store = {
    claimOutbox: async () => {calls.claim++; return lease;},
    ackOutbox: async () => true
  };
  const relay = {next: async worker => {
    calls.next.push(worker);
    return {state:'dispatched',ticket:'T1',worker,receipt_url:'https://example.com/receipt'};
  }};
  return {calls,store,relay};
}

for (const [name,roster] of [
  ['one empty slot',new Array(1)],
  ['leading hole',[,'worker2']],
  ['middle hole',['worker1',,'worker3']]
]) {
  test(`reject ${name} before claiming outbox or invoking worker`,async () => {
    const {calls,store,relay} = fixture();
    await assert.rejects(drainOne({store,relay,workerIds:roster}),/Qualified worker roster/);
    assert.equal(calls.claim,0);
    assert.deepEqual(calls.next,[]);
  });
}

test('valid dense roster still dispatches and acknowledges',async () => {
  const {calls,store,relay} = fixture();
  const result = await drainOne({store,relay,workerIds:['worker1']});
  assert.equal(result.state,'acknowledged');
  assert.deepEqual(calls.next,['worker1']);
  assert.equal(calls.claim,1);
});

test('duplicate worker roster remains invalid before claim',async () => {
  const {calls,store,relay} = fixture();
  await assert.rejects(drainOne({store,relay,workerIds:['worker1','worker1']}),/Qualified worker roster/);
  assert.equal(calls.claim,0);
  assert.deepEqual(calls.next,[]);
});
