import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler} from '../ops/relay/portable-relay.mjs';

const SECRET='callback-secret-is-long-enough-123';
const invoke=(handler,type='completed')=>handler({
  method:'POST',headers:{authorization:'Bearer '+SECRET},
  body:JSON.stringify({type,ticket_id:'T1'})
});

test('provider RPC outage returns retryable HTTP 503 rather than terminal 409',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{
    completed:async()=>{throw Error('RPC complete HTTP 503');}
  }});
  const response=await invoke(handler);
  assert.equal(response.statusCode,503);
  assert.match(JSON.parse(response.body).error,/RPC complete HTTP 503/);
});

test('network error on event-driven NEXT requests retry',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{
    completed:async()=>{throw Error('fetch failed');}
  }});
  const response=await invoke(handler,'completed');
  assert.equal(response.statusCode,503);
});

test('invalid or stale completion remains HTTP 409',async()=>{
  const handler=makeHandler({callbackSecret:SECRET,relay:{
    completed:async()=>{throw Error('Invalid completion');}
  }});
  const response=await invoke(handler);
  assert.equal(response.statusCode,409);
});
