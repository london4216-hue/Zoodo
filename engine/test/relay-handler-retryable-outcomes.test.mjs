import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../ops/relay/portable-relay.mjs';
const SECRET='valid-private-relay-secret-123456789';
const request=(handler,type)=>handler({method:'POST',headers:{authorization:'Bearer '+SECRET},body:JSON.stringify({type,worker:'worker-a'})});

test('unconfirmed kick returns HTTP 503 for provider retry',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{next:async()=>({state:'next-unconfirmed'})}});
  assert.equal((await request(handler,'kick')).statusCode,503);
});
test('unacknowledged outbox replay returns HTTP 503',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{replay:async()=>({state:'ack-unconfirmed'})}});
  assert.equal((await request(handler,'replay')).statusCode,503);
});
test('reconcile stage failure returns HTTP 503',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{reconcile:async()=>({state:'reconcile-unconfirmed'})}});
  assert.equal((await request(handler,'reconcile')).statusCode,503);
});
test('acknowledged replay stays HTTP 200',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{replay:async()=>({state:'acked'})}});
  assert.equal((await request(handler,'replay')).statusCode,200);
});
test('unconfirmed NEXT after completed transition must not retry completed callback',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{completed:async()=>({state:'completed',next:{state:'next-unconfirmed'}})}});
  assert.equal((await request(handler,'completed')).statusCode,200);
});
test('unauthenticated control endpoint remains forbidden',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{replay:async()=>({state:'acked'})}});
  assert.equal((await handler({method:'POST',headers:{},body:'{"type":"replay"}'})).statusCode,401);
});
