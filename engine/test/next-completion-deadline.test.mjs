import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRelay,makeHandler} from '../ops/relay/portable-relay.mjs';
const SHA='a'.repeat(40), TOKEN='00000000-0000-4000-8000-000000000001';
const SECRET='callback-secret-for-tests-only-123456';
const WORKER_SECRET='worker-secret-for-tests-only-123456';
const worker={id:'w',url:'https://example.org/worker',token:WORKER_SECRET};
const completion={type:'completed',ticket_id:'T1',worker:'w',lease_token:TOKEN,commit_sha:SHA,test_url:'https://example.org/tests/T1'};

test('authenticated completion callback returns promptly when NEXT claim hangs',async()=>{
  let persisted=0;
  const store={
    complete:async()=>{persisted++;return true},
    claim:async()=>new Promise(()=>{})
  };
  const relay=makeRelay({store,workers:[worker],nextDeadlineMs:20});
  const handler=makeHandler({relay,callbackSecret:SECRET});
  const response=await handler({method:'POST',headers:{authorization:'Bearer '+SECRET},body:JSON.stringify(completion)});
  assert.equal(response.statusCode,200);
  const result=JSON.parse(response.body);
  assert.equal(result.state,'completed');
  assert.equal(result.next.state,'next-unconfirmed');
  assert.equal(persisted,1);
});

test('authenticated non-execution callback returns promptly when NEXT claim hangs',async()=>{
  const store={
    notStarted:async()=>true,
    claim:async()=>new Promise(()=>{})
  };
  const relay=makeRelay({store,workers:[worker],nextDeadlineMs:20});
  const result=await relay.notStarted({ticket_id:'T1',worker:'w',lease_token:TOKEN,evidence_url:'https://example.org/native/T1'});
  assert.equal(result.state,'requeued');
  assert.equal(result.next.state,'next-unconfirmed');
});

test('NEXT claim error leaves committed transition intact',async()=>{
  const store={
    complete:async()=>true,
    claim:async()=>{throw Error('temporary storage outage')}
  };
  const relay=makeRelay({store,workers:[worker],nextDeadlineMs:20});
  const result=await relay.completed(completion);
  assert.equal(result.state,'completed');
  assert.equal(result.next.state,'recovery_required');
});
